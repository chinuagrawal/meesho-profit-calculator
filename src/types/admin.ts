export interface AdminAccount {
  uid: string;
  fullName?: string | null;
  storeName?: string | null;
  phoneNumber: string | null;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  disabled: boolean;
}
