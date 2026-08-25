declare module "@maniac-tech/react-native-expo-read-sms" {
  export function startReadSMS(
    callback: (status: "success" | "error", sms: string, error?: string) => void
  ): Promise<void>;
  export function stopReadSMS(): void;
  export function checkIfHasSMSPermission(): Promise<{
    hasReceiveSmsPermission: boolean;
    hasReadSmsPermission: boolean;
  }>;
  export function requestReadSMSPermission(): Promise<boolean>;
}
