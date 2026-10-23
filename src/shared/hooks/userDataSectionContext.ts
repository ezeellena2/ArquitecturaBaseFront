import { createContext, type ComponentType } from "react";

export interface UserDataSaveState {
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly ready: boolean;
  readonly save: () => Promise<boolean>;
}
export interface UserDataSectionProps {
  readonly userId: string;
  readonly disabled: boolean;
  readonly userSaved: boolean;
  readonly onState: (state: UserDataSaveState) => void;
}
export interface UserDataSectionExtension {
  readonly Section: ComponentType<UserDataSectionProps>;
  readonly openUser: (userId: string) => void;
}
/** App composes optional data. Account editing never imports a module. */
export const UserDataSectionContext = createContext<UserDataSectionExtension | null>(null);
