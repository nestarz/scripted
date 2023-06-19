const JsonStringifyWithBigIntSupport = (data: unknown) => {
  if (data !== undefined) {
    return JSON.stringify(data, (_, v) =>
      typeof v === "bigint" ? `${v}#bigint` : v
    ).replace(/"(-?\d+)#bigint"/g, (_, a) => a);
  }
};

export const getHashSync = (str: string) =>
  String(
    str.split("").reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0)
  ).replace(/-/g, "");

const scriptStore: [Map<string, string>, Map<string, string>] = [
  new Map(),
  new Map(),
];

export const clearScriptStore = () => scriptStore.forEach((map) => map.clear());

export const storeGlobalValues = (
  globals: Record<string, unknown> = {}
): void => {
  Object.entries(globals)
    .map(([k, v]) => [
      k,
      typeof v === "function" ? v.toString() : JsonStringifyWithBigIntSupport(v),
    ])
    .map(([k, v]) => scriptStore[0].set(k, `const ${k} = ${v};`));
};

export const collectScriptContents = (): string =>
  scriptStore
    .flatMap((d) => d.values())
    .map((d) => [...d])
    .flat()
    .join("\n");

export const collectAndCleanScripts = (): string => {
  const res = collectScriptContents();
  clearScriptStore();
  return res;
};

export const storeFunctionWithArgs = (
  fn: Function,
  ...args: any[]
): [string, string, string[]] => {
  const setFn = (fn: Function): string => {
    const id = `_${getHashSync(fn.toString())}`;
    scriptStore[1].set(id, `const fn${id} = ${fn.toString()};`);
    return id;
  };
  const id = setFn(fn);
  const argsStrArr = args.map((v) =>
    typeof v === "function"
      ? `fn${setFn(v)}`
      : typeof v === "undefined"
      ? "undefined"
      : JsonStringifyWithBigIntSupport(v)
  );
  const argsId = getHashSync(argsStrArr.join(""));
  const elId = [id, argsId].join("_");

  scriptStore[1].set(elId, `fn${id}(${argsStrArr.join(", ")});`);
  return [id, elId, argsStrArr];
};

export const storeFunctionExecution = (
  fn: Function,
  ...args: any[]
): string => {
  const [id, elId, argsStrArr] = storeFunctionWithArgs(fn, ...args);
  scriptStore[1].set(elId, `fn${id}(${argsStrArr.join(", ")});`);
  return elId;
};

export const scripted = (
  fn: Function,
  ...args: any[]
): string => {
  const [id, elId, argsStrArr] = storeFunctionWithArgs(fn, ...args);
  scriptStore[1].set(
    elId,
    `document.querySelectorAll(".${elId}").forEach(${
      argsStrArr.length > 0
        ? `(n) => fn${id}(${["n", ...argsStrArr].join(", ")})`
        : `fn${id}`
    });`
  );
  return elId;
};
