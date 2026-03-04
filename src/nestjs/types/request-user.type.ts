export interface RequestUser {
  keycloakId: string;
  email?: string;
  username?: string;
  roles: string[];
}
