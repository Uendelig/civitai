import React from 'react';
import { Anchor, Button, Center, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { ClubTier } from '~/types/router';
import { CurrencyBadge } from '~/components/Currency/CurrencyBadge';
import { constants } from '~/server/common/constants';
import { ImageGuard } from '~/components/ImageGuard/ImageGuard';
import { MediaHash } from '~/components/ImageHash/ImageHash';
import { ImagePreview } from '~/components/ImagePreview/ImagePreview';
import { ImageCSSAspectRatioWrap } from '~/components/Profile/ImageCSSAspectRatioWrap';
import { RenderHtml } from '~/components/RenderHtml/RenderHtml';
import { ContentClamp } from '~/components/ContentClamp/ContentClamp';
import { useClubFeedStyles } from '~/components/Club/ClubPost/ClubFeed';
import { useClubContributorStatus, useMutateClub } from '~/components/Club/club.utils';
import { BuzzTransactionButton } from '~/components/Buzz/BuzzTransactionButton';
import { closeModal, openConfirmModal } from '@mantine/modals';
import { showSuccessNotification } from '~/utils/notifications';
import { formatDate } from '~/utils/date-helpers';
import dayjs from 'dayjs';
import { calculateClubTierNextBillingDate } from '~/utils/clubs';
import { trpc } from '~/utils/trpc';
import { useUserPaymentMethods } from '~/components/Stripe/stripe.utils';
import { dialogStore } from '~/components/Dialog/dialogStore';
import { useRouter } from 'next/router';
import { StripePaymentMethodSetupModal } from '~/components/Modals/StripePaymentMethodSetupModal';
import { LoginPopover } from '~/components/LoginPopover/LoginPopover';

export const ClubTierItem = ({ clubTier }: { clubTier: ClubTier }) => {
  const router = useRouter();
  const { classes } = useClubFeedStyles();
  const { isOwner, isLoading: isLoadingOwnership } = useClubContributorStatus({
    clubId: clubTier.clubId,
  });
  const { data: membership, isLoading } = trpc.clubMembership.getClubMembershipOnClub.useQuery({
    clubId: clubTier.clubId,
  });
  const { userPaymentMethods } = useUserPaymentMethods();

  const {
    creatingClubMembership,
    createClubMembership,
    updateClubMembership,
    updatingClubMembership,
    cancelClubMembership,
    cancelingClubMembership,
    restoreClubMembership,
    restoringClubMembership,
  } = useMutateClub();

  const updating =
    updatingClubMembership ||
    creatingClubMembership ||
    cancelingClubMembership ||
    restoringClubMembership;

  const isTierMember = membership?.clubTier?.id === clubTier.id;
  const remainingSpots = clubTier.memberLimit
    ? Math.max(0, clubTier.memberLimit - clubTier._count.memberships)
    : undefined;

  const TierCoverImage = () =>
    clubTier.coverImage ? (
      <Center>
        <ImageCSSAspectRatioWrap
          aspectRatio={1}
          style={{ width: constants.clubs.tierImageSidebarDisplayWidth }}
        >
          <ImageGuard
            images={[clubTier.coverImage]}
            connect={{ entityId: clubTier.clubId, entityType: 'club' }}
            render={(image) => {
              return (
                <ImageGuard.Content>
                  {({ safe }) => (
                    <>
                      {!safe ? (
                        <MediaHash {...image} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <ImagePreview
                          image={image}
                          edgeImageProps={{ width: 450 }}
                          radius="md"
                          style={{ width: '100%', height: '100%' }}
                          aspectRatio={0}
                        />
                      )}
                      <div style={{ width: '100%', height: '100%' }}>
                        <ImageGuard.ToggleConnect position="top-left" />
                      </div>
                    </>
                  )}
                </ImageGuard.Content>
              );
            }}
          />
        </ImageCSSAspectRatioWrap>
      </Center>
    ) : null;

  const handleMembershipJoin = async () => {
    closeModal('stripe-transaction-modal');
    openConfirmModal({
      modalId: 'club-membership-create',
      centered: true,
      title: 'You are about to become a member of this club tier',
      children: (
        <Center>
          <Stack>
            <TierCoverImage />
            <Text align="center" weight={800}>
              {clubTier.name}
            </Text>
            <Text align="center">
              You will be charged the membership fee immediately and get access to this tier&rsquo;s
              benefits. Memberships are billed monthly and can be canceled at any time.
            </Text>

            <Text color="dimmed" size="sm" align="center">
              Your next billing date will be on {formatDate(dayjs().add(1, 'month').toDate())}
            </Text>
          </Stack>
        </Center>
      ),
      labels: { cancel: `No`, confirm: `Yes` },
      closeOnConfirm: true,
      onConfirm: async () => {
        try {
          await createClubMembership({
            clubTierId: clubTier.id,
          });

          showSuccessNotification({
            title: 'Success',
            message: 'You are now a member of this club! Enjoy your stay.',
          });

          if (userPaymentMethods.length === 0) {
            dialogStore.trigger({
              component: StripePaymentMethodSetupModal,
              props: {
                redirectUrl: router.asPath,
                message: (
                  <Stack>
                    <Text>You are now a member of this club! Enjoy your stay.</Text>
                    <Text>
                      Adding a payment method will ensure that your membership will be renewed by
                      the end of the month each day. It is the ideal way to keep supporting your
                      favorite creators. We will only charge you when your membership is renewed and
                      if your buzz amount does not meet the required amount.
                    </Text>
                    <Text>
                      You can always add a payment method later in your{' '}
                      <Anchor href="/user/account#payment-methods">account settings.</Anchor>
                    </Text>

                    <Text weight="bold">Your card will not be charged at this time.</Text>
                  </Stack>
                ),
              },
            });
          }
        } catch (err) {
          // Do nothing, alert is handled in the hook
        }
      },
    });
  };

  const isUpgrade = membership && !isTierMember && membership.unitAmount < clubTier.unitAmount;
  const isDowngrade = membership && !isTierMember && membership.unitAmount > clubTier.unitAmount;
  const isNextDowngradeTier = membership && membership.downgradeClubTierId === clubTier.id;

  const handleMembershipUpdate = async () => {
    closeModal('stripe-transaction-modal');
    const onUpdateMembership = async () => {
      try {
        updateClubMembership({
          clubTierId: clubTier.id,
        });

        showSuccessNotification({
          title: 'Success',
          message: 'Your membership has been upgraded.',
        });
      } catch {
        // Do nothing. Handled in the hook.
      }
    };

    if (isUpgrade) {
      const { nextBillingDate, addedDaysFromCurrentTier } = calculateClubTierNextBillingDate({
        membership,
        upgradeTier: clubTier,
      });

      openConfirmModal({
        modalId: 'club-membership-create',
        centered: true,
        title: 'You are about to change your current membership to this club tier',
        children: (
          <Center>
            <Stack>
              <TierCoverImage />
              <Text align="center" weight={800}>
                {clubTier.name}
              </Text>
              <Text align="center">
                You will be charged the membership fee{' '}
                <Text component="span" weight="bold">
                  immediately
                </Text>{' '}
                and get access to this tier&rsquo;s benefits.
              </Text>

              <Stack mt="md">
                <Text align="center" weight="bold">
                  Your next billing date will be on {formatDate(nextBillingDate)}.
                </Text>
                <Text color="dimmed" align="center" size="sm">
                  An additional{' '}
                  <Text component="span" weight="bold">
                    {addedDaysFromCurrentTier} days
                  </Text>{' '}
                  will be added to your new membership period to account for the remaining days in
                  your current membership.
                </Text>
              </Stack>
            </Stack>
          </Center>
        ),
        labels: { cancel: `Cancel`, confirm: `Confirm` },
        closeOnConfirm: true,
        onConfirm: onUpdateMembership,
      });
    } else {
      openConfirmModal({
        modalId: 'club-membership-create',
        centered: true,
        title: 'You are about to change your current membership to this club tier',
        children: (
          <Center>
            <Stack>
              <TierCoverImage />
              <Text align="center" weight={800}>
                {clubTier.name}
              </Text>
              <Text align="center">
                You will not be charged at this time. Your membership will be updated at your next
                billing date on {formatDate(membership?.nextBillingAt)}.
              </Text>
            </Stack>
          </Center>
        ),
        labels: { cancel: `Cancel`, confirm: `Confirm` },
        closeOnConfirm: true,
        onConfirm: onUpdateMembership,
      });
    }
  };

  const handleMembershipRestore = async () => {
    try {
      await restoreClubMembership({
        clubId: clubTier.clubId,
      });

      showSuccessNotification({
        title: 'Success',
        message: `Your membership has been restored. Your next billing date is ${formatDate(
          membership?.nextBillingAt
        )}.`,
      });
    } catch {
      // Do nothing. Handled in the hook.
    }
  };

  const handleMembershipCancel = async () => {
    const onCancelMembership = async () => {
      try {
        await cancelClubMembership({
          clubId: clubTier.clubId,
        });

        showSuccessNotification({
          title: 'Success',
          message: `Your membership has been canceled. You will have access to this club's resources until ${formatDate(
            membership?.nextBillingAt
          )}.`,
        });
      } catch {
        // Do nothing. Handled in the hook.
      }
    };

    openConfirmModal({
      modalId: 'club-membership-cancel',
      centered: true,
      title: 'You are about to cancel your current membership',
      children: (
        <Center>
          <Stack>
            <TierCoverImage />
            <Text align="center" weight={800}>
              {clubTier.name}
            </Text>
            <Text align="center">
              {' '}
              Your membership will be canceled at the end of your current billing period on{' '}
              {formatDate(membership?.nextBillingAt)} and no more charges to your account will be
              made.
            </Text>
          </Stack>
        </Center>
      ),
      labels: { cancel: `Cancel`, confirm: `Confirm` },
      closeOnConfirm: true,
      onConfirm: onCancelMembership,
    });
  };

  return (
    <Paper className={classes.feedContainer}>
      <Stack style={{ flex: 1 }}>
        <TierCoverImage />

        <Stack align="center" spacing={4}>
          <Title order={4}>{clubTier.name}</Title>
          <CurrencyBadge
            size="lg"
            currency={clubTier.currency}
            unitAmount={clubTier.unitAmount}
            w="100%"
          />
        </Stack>
        <ContentClamp maxHeight={200}>
          <RenderHtml html={clubTier.description} />
        </ContentClamp>
        {!isOwner && (
          <LoginPopover>
            {isNextDowngradeTier ? (
              <Button loading={updating} radius="md" color="yellow.7" variant="light">
                Active on {formatDate(membership.nextBillingAt)}
              </Button>
            ) : isTierMember ? (
              <Stack spacing={4}>
                <Button
                  loading={updating}
                  radius="md"
                  color="yellow.7"
                  variant="light"
                  onClick={
                    membership.downgradeClubTierId
                      ? handleMembershipUpdate
                      : membership.cancelledAt
                      ? handleMembershipRestore
                      : handleMembershipCancel
                  }
                >
                  Active{' '}
                  {membership.expiresAt
                    ? `until ${formatDate(membership.expiresAt)}`
                    : membership.downgradeClubTierId
                    ? `until ${formatDate(membership.nextBillingAt)}`
                    : null}
                </Button>
                {membership?.cancelledAt && (
                  <Text size="xs" align="center">
                    Click to restore
                  </Text>
                )}
              </Stack>
            ) : isDowngrade ? (
              <Button
                loading={updating}
                radius="md"
                color="yellow.7"
                variant="light"
                onClick={handleMembershipUpdate}
                disabled={remainingSpots === 0}
              >
                Downgrade
              </Button>
            ) : (
              <BuzzTransactionButton
                disabled={updating || remainingSpots === 0}
                loading={updating}
                buzzAmount={clubTier.unitAmount}
                radius="md"
                onPerformTransaction={isUpgrade ? handleMembershipUpdate : handleMembershipJoin}
                label={isUpgrade ? 'Upgrade' : 'Become a member'}
              />
            )}
          </LoginPopover>
        )}
        {remainingSpots !== undefined && (
          <Text align="center" size="xs" color="yellow.7">
            {remainingSpots} spots left
          </Text>
        )}
      </Stack>
    </Paper>
  );
};
