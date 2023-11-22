import { Container } from '@mantine/core';

import { getFeatureFlags } from '~/server/services/feature-flags.service';
import { createServerSideProps } from '~/server/utils/server-side-helpers';
import { getLoginLink } from '~/utils/login-helpers';
import { BountyUpsertForm } from '~/components/Bounty/BountyUpsertForm';
import { ClubUpsertForm } from '~/components/Club/ClubUpsertForm';

export const getServerSideProps = createServerSideProps({
  useSession: true,
  resolver: async ({ session, ctx }) => {
    const features = getFeatureFlags({ user: session?.user });
    if (!features.clubs) return { notFound: true };

    if (!session)
      return {
        redirect: {
          destination: getLoginLink({ returnUrl: ctx.resolvedUrl, reason: 'create-club' }),
          permanent: false,
        },
      };
    if (session.user?.muted) return { notFound: true };
  },
});

export default function ClubCreate() {
  return (
    <Container size="md">
      <ClubUpsertForm />
    </Container>
  );
}
