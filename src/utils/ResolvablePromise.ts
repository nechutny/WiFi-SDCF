declare type TResolveFunc<T> = (result?: T | PromiseLike<T>) => void;
declare type TRejectFunc = (reason?: any) => void;

export class ResolvablePromise<T> extends Promise<T> implements PromiseLike<T> {
	public resolve: TResolveFunc<T>;
	public reject: TRejectFunc;

	public constructor(func?: (resolve: TResolveFunc<T>, reject: TRejectFunc) => any) {
		let resolveFunc: TResolveFunc<T>;
		let rejectFunc: TRejectFunc;

		super((resolve, reject) => {
			if(func) {
				func(resolve, reject);
			}

			// Because we can't assign anything to "this" until is finished call to super
			resolveFunc = resolve;
			rejectFunc = reject;
		});

		this.resolve = resolveFunc!;
		this.reject = rejectFunc!;
	}
}
