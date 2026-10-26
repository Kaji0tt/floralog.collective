import GuestAccountDialog from "@/components/home/GuestAccountDialog";

/**
 * Modal shown to guest users when they try to perform an action that requires authentication.
 *
 * Shares the email/Google account dialog with the post-scan guest funnel.
 */
export default function GuestLoginModal({ open, onClose }) {
  return <GuestAccountDialog open={open} onClose={onClose} />;
}
