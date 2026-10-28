export interface AdminAccount {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  disabled: boolean;
}
