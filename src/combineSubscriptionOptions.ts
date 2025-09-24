import ISubscriptionOptions from "./ISubscriptionOptions";

/**
 * Combines subscription options where only null (not undefined) overrides base defaults.
 *
 * @param base The base subscription options (defaults)
 * @param override The override subscription options
 * @returns Combined subscription options
 */
export default function combineSubscriptionOptions(base?: ISubscriptionOptions, override?: ISubscriptionOptions): ISubscriptionOptions {
  return {
    timeoutStrategy: override?.timeoutStrategy !== undefined ? override.timeoutStrategy : base?.timeoutStrategy,
  };
}
