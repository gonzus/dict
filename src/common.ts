export interface Options {
  lang?: string;
  categories?: string;
}

export interface IntToBool {
  [name: number]: boolean;
}

export interface IntToStr {
  [name: number]: string;
}

export interface StrToInt {
  [name: string]: number;
}


export const Program = {
  Version: '0.0.5',
};

export const Default = {
  Language: 'en',
  Part: 'noun',
};
