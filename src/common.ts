/**
 * Type describing command-line options.
 */
export interface Options {
  lang?: string;
  categories?: string;
}

/**
 * A hash from number to boolean.
 */
export interface IntToBool {
  [name: number]: boolean;
}

/**
 * A hash from number to string.
 */
export interface IntToStr {
  [name: number]: string;
}

/**
 * A hash from string to number.
 */
export interface StrToInt {
  [name: string]: number;
}


/**
 * Program-related constants.
 */
export const Program = {
  Version: '0.0.5',
};

/**
 * Some default values.
 */
export const Default = {
  Language: 'en',
  Part: 'noun',
};
