import { METHOD_GROUPS, METHODS } from "./registry";

function ComparisonIndexPage() {
  return (
    <main
      className="mx-auto min-h-screen w-full max-w-6xl p-[clamp(1.25rem,3vw,3rem)] text-[#28241f]"
      data-testid="compare-index"
    >
      <header className="mb-8">
        <p className="mb-2 text-sm font-bold tracking-[0.12em] text-[#9a5634] uppercase">
          PhotoColorChanger
        </p>
        <h1 className="mb-3 text-3xl font-bold">色置き換え手法の比較</h1>
        <p className="text-[#6e675e]">
          同じ画像とクリック位置を使って、色判定・範囲判定・再着色をブラウザ内で比較できます。
        </p>
        <a
          className="mt-4 inline-block text-sm font-semibold text-[#8a482a] underline underline-offset-4"
          href="#/"
        >
          編集画面へ戻る
        </a>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {METHOD_GROUPS.map((group) => (
          <section key={group.axis} className="rounded-2xl border border-[#ded6c9] bg-white p-5">
            <h2 className="mb-4 text-xl font-bold">{group.title}</h2>
            <ul className="space-y-3">
              {METHODS.filter((method) => method.axis === group.axis).map((method) => (
                <li key={method.id}>
                  <a
                    className="block rounded-xl border border-[#e8e1d7] p-4 transition hover:border-[#9a5634] hover:bg-[#faf7f2]"
                    data-testid={"compare-link-" + method.id}
                    href={"#/compare/" + method.id}
                  >
                    <span className="mb-1 block font-semibold">{method.title}</span>
                    <span className="block text-sm leading-6 text-[#6e675e]">
                      {method.description}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

export default ComparisonIndexPage;
