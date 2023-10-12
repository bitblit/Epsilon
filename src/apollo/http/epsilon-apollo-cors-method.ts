// NOTE: This is a psuedo-enum to fix some issues with Typescript enums.  See: https://exploringjs.com/tackling-ts/ch_enum-alternatives.html for details
export const EpsilonApolloCorsMethod = {
  None: 'None',
  All: 'All',
  Reflective: 'Reflective',
};
export type EpsilonApolloCorsMethod = (typeof EpsilonApolloCorsMethod)[keyof typeof EpsilonApolloCorsMethod];
