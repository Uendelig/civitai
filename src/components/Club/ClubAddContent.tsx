import { Group, Modal, Stack, UnstyledButton, Text, createStyles } from '@mantine/core';
import { useDialogContext } from '../Dialog/DialogProvider';
import { dialogStore } from '../Dialog/dialogStore';
import { IconFile, IconPencilMinus } from '@tabler/icons-react';
import { ClubPostUpsertFormModal } from './ClubPost/ClubPostUpsertForm';
import { AddResourceToClubModal } from './AddResourceToClubModal';
import { ClubAdminPermission } from '@prisma/client';
import { useClubContributorStatus } from './club.utils';

const useStyles = createStyles((theme) => ({
  button: {
    background: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    width: '150px',
  },
}));

export const ClubAddContent = ({ clubId }: { clubId: number }) => {
  const dialog = useDialogContext();
  const handleClose = dialog.onClose;
  const { classes } = useStyles();
  const { isOwner, isModerator, isClubAdmin, permissions } = useClubContributorStatus({
    clubId,
  });

  const canCreatePosts =
    isOwner || isModerator || permissions.includes(ClubAdminPermission.ManagePosts);

  const canCreateResources = isOwner || isClubAdmin;

  const noActions = !canCreatePosts && !canCreateResources;

  return (
    <Modal {...dialog} title="Add content to this club" size="sm" withCloseButton>
      <Stack>
        <Group position="apart">
          {canCreatePosts && (
            <UnstyledButton
              className={classes.button}
              onClick={() => {
                dialogStore.trigger({
                  component: ClubPostUpsertFormModal,
                  props: {
                    clubId,
                  },
                });

                handleClose();
              }}
            >
              <Stack align="center">
                <IconPencilMinus />
                <Text size="sm">Add Post</Text>
              </Stack>
            </UnstyledButton>
          )}
          {canCreateResources && (
            <UnstyledButton
              className={classes.button}
              onClick={() => {
                dialogStore.trigger({
                  component: AddResourceToClubModal,
                });

                handleClose();
              }}
            >
              <Stack align="center">
                <IconFile />
                <Text size="sm">Resource</Text>
              </Stack>
            </UnstyledButton>
          )}
        </Group>
        {noActions && (
          <Text size="sm" color="dimmed">
            You don&rsquo;t have permissions to add content to this club.
          </Text>
        )}
      </Stack>
    </Modal>
  );
};
