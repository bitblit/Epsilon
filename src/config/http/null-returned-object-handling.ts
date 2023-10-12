// NOTE: This is a psuedo-enum to fix some issues with Typescript enums.  See: https://exploringjs.com/tackling-ts/ch_enum-alternatives.html for details
export const NullReturnedObjectHandling = {
  Error: 'Error',
  ConvertToEmptyString: 'ConvertToEmptyString',
  Return404NotFoundResponse: 'Return404NotFoundResponse',
};
export type NullReturnedObjectHandling = (typeof NullReturnedObjectHandling)[keyof typeof NullReturnedObjectHandling];
