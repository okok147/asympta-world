export function SemanticDialogueLabels() {
  return (
    <style>{`
      .business-thought--food .business-thought-icons::after { content: "尋找食物" !important; }
      .business-thought--deal .business-thought-icons::after { content: "接受交易" !important; }
      .business-thought--skill .business-thought-icons::after { content: "交換技能" !important; }
      .business-thought--enquiry .business-thought-icons::after { content: "尋找協助" !important; }
      .business-thought--resource .business-thought-icons::after { content: "交易資源" !important; }
      .business-thought--workflow .business-thought-icons::after { content: "執行任務" !important; }
      .business-thought--energy .business-thought-icons::after { content: "補充能量" !important; }
      .business-thought--status .business-thought-icons::after { content: "觀察中" !important; }
    `}</style>
  );
}
