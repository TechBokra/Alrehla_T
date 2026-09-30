import { redirect } from 'next/navigation';

// Notifications moved out of the customer account area so every role can reach
// them. This keeps old links and bookmarks working.
export default function AccountNotificationsPage() {
  redirect('/notifications');
}
