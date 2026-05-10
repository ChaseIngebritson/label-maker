export type Region = "US" | "UK";

export type InputTab = "upload" | "manual" | "return";

export interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  topMargin: number;
  sideMargin: number;
  hPitch: number;
  vPitch: number;
  cols: number;
  rows: number;
}

export interface Address {
  title: string;
  firstName: string;
  lastName: string;
  suffix: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type LabelFont = "helvetica" | "times" | "courier";

export interface ReturnLabelStyle {
  font: LabelFont;
  leadingSymbol: string;
}
