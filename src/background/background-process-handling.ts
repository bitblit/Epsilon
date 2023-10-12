// NOTE: This is a psuedo-enum to fix some issues with Typescript enums.  See: https://exploringjs.com/tackling-ts/ch_enum-alternatives.html for details
export const BackgroundProcessHandling = {
  Queued: 'Queued',
  Immediate: 'Immediate',
};
export type BackgroundProcessHandling = (typeof BackgroundProcessHandling)[keyof typeof BackgroundProcessHandling];
