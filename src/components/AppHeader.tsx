function AppHeader() {
  return (
    <header className="mb-[clamp(1.5rem,4vw,3rem)] max-w-[760px]">
      <p className="mb-2 text-[0.8rem] font-bold tracking-[0.12em] text-[#9a5634] uppercase">
        PhotoColorChanger
      </p>
      <h1 className="mb-3 text-[clamp(1.8rem,4vw,3.3rem)] leading-[1.2]">
        塗装後の色を、写真で確認する
      </h1>
      <p className="text-[#6e675e] leading-[1.7]">
        プラモデルの写真を読み込み、色を置き換えたイメージをブラウザ内で確認できます。
      </p>
    </header>
  );
}

export default AppHeader;
