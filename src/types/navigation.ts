export type RootStackParamList = {
  // Auth
  Login: undefined;
  Register: undefined;
  EmailVerification: {
    email: string;
    fullName: string;
  };

  // Resident
  SetHomeLocation: undefined;
  Home: undefined;
  Profile: undefined;
  EmergencyContacts: undefined;
  EditProfile: undefined;
  Alert: undefined;
  ActiveAlert: {
    alertId: string;
  };

  // Guard
  GuardHome: undefined;
  GuardAlerts: undefined;
  GuardActiveAlert: {
    alertId: string;
  };
};