function HistoryPanel() {
  return (
    <aside
      className="min-h-[420px] rounded-2xl border border-[#ded7ca] bg-[rgb(255_253_248_/_75%)] p-5 shadow-[0_1rem_2.5rem_rgb(75_59_42_/_7%)] max-[900px]:col-span-full max-[900px]:min-h-0"
      aria-labelledby="history-title"
    >
      <h2 id="history-title" className="mb-3 text-base">
        履歴
      </h2>
      <p className="mb-0 text-[0.9rem] leading-[1.7] text-[#6e675e]">
        色の変更履歴は、ここに表示されます。
      </p>
    </aside>
  );
}

export default HistoryPanel;
