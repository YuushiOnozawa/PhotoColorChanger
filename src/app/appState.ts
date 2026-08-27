export type ImageSessionStatus = "empty";

export interface AppState {
  imageSessionStatus: ImageSessionStatus;
}

export const initialAppState: AppState = {
  imageSessionStatus: "empty",
};
