import { dbWrite, dbRead } from '~/server/db/client';
import { UpsertClubInput, UpsetClubTiersInput } from '~/server/schema/club.schema';
import { BountyDetailsSchema, CreateBountyInput } from '~/server/schema/bounty.schema';
import { BountyEntryMode, Currency, Prisma, TagTarget } from '@prisma/client';
import { createBuzzTransaction, getUserBuzzAccount } from '~/server/services/buzz.service';
import { throwBadRequestError, throwInsufficientFundsError } from '~/server/utils/errorHandling';
import { startOfDay, toUtc } from '~/utils/date-helpers';
import { updateEntityFiles } from '~/server/services/file.service';
import { createEntityImages } from '~/server/services/image.service';
import { TransactionType } from '~/server/schema/buzz.schema';
import { ImageUploadProps } from '~/server/schema/image.schema';
import { isDefined } from '~/utils/type-guards';

export function upsertClub({
  isModerator,
  userId,
  id,
  ...input
}: UpsertClubInput & { userId: number; isModerator: boolean }) {
  if (id) {
    // TODO: Update club
  } else {
    return createClub({ ...input, userId });
  }
}

export const createClub = async ({
  coverImage,
  headerImage,
  avatarImage,
  tiers = [],
  deleteTierIds = [],
  userId,
  ...data
}: Omit<UpsertClubInput, 'id'> & { userId: number }) => {
  const club = await dbWrite.$transaction(
    async (tx) => {
      const createdImages = await createEntityImages({
        tx,
        images: [coverImage, headerImage, avatarImage].filter((i) => !i?.id).filter(isDefined),
        userId,
      });

      const club = await tx.club.create({
        data: {
          ...data,
          userId,
          avatarId:
            avatarImage === null
              ? null
              : avatarImage !== undefined
              ? avatarImage?.id ?? createdImages.find((i) => i.url === avatarImage.url)?.id
              : undefined,
          coverImageId:
            coverImage === null
              ? null
              : coverImage !== undefined
              ? coverImage?.id ?? createdImages.find((i) => i.url === coverImage.url)?.id
              : undefined,
          headerImageId:
            headerImage === null
              ? null
              : headerImage !== undefined
              ? headerImage?.id ?? createdImages.find((i) => i.url === headerImage.url)?.id
              : undefined,
        },
      });

      // Create tiers:
      await upsertClubTiers({
        clubId: club.id,
        tiers,
        deleteTierIds,
        userId,
        tx,
      });

      return club;
    },
    { maxWait: 10000, timeout: 30000 }
  );

  return club;
};

const upsertClubTiers = async ({
  clubId,
  tiers,
  deleteTierIds,
  tx,
  userId,
}: {
  userId: number;
  clubId: number;
  deleteTierIds: number[];
  tiers: UpsetClubTiersInput[];
  tx?: Prisma.TransactionClient;
}) => {
  const dbClient = tx ?? dbWrite;

  if ((deleteTierIds?.length ?? 0) > 0) {
    const deletingTierWithMembers = await dbClient.clubTier.findFirst({
      where: {
        id: {
          in: deleteTierIds,
        },
        memberships: {
          some: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (deletingTierWithMembers) {
      throw throwBadRequestError(
        'Cannot delete tier with members. Please move the members out of this tier before deleting it.'
      );
    }

    await dbClient.clubTier.deleteMany({
      where: {
        id: {
          in: deleteTierIds,
        },
      },
    });
  }

  const createdImages = await createEntityImages({
    userId,
    images: tiers
      .filter((tier) => tier.coverImage?.id === undefined)
      .map((tier) => tier.coverImage)
      .filter(isDefined),
    tx: dbClient,
  });

  const toCreate = tiers.filter((tier) => !tier.id);
  if (toCreate.length > 0) {
    await dbClient.clubTier.createMany({
      data: toCreate.map((tier) => ({
        ...tier,
        clubId,
        coverImageId:
          tier.coverImage?.id ?? createdImages.find((i) => i.url === tier.coverImage?.url)?.id,
      })),
      skipDuplicates: true,
    });
  }

  const toUpdate = tiers.filter((tier) => tier.id !== undefined);
  if (toUpdate.length > 0) {
    await dbClient.clubTier.updateMany({
      where: {
        id: {
          in: toUpdate.map((tier) => tier.id as number),
        },
      },
      data: toUpdate.map(({ coverImage, ...tier }) => ({
        ...tier,
        coverImageId:
          coverImage === null
            ? null
            : coverImage === undefined
            ? undefined
            : coverImage?.id ?? createdImages.find((i) => i.url === coverImage?.url)?.id,
        clubId,
      })),
    });
  }
};
