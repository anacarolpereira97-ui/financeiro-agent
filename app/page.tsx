"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Gasto = { id: string; descricao: string; valor: number; forma: "avista" | "parcelado"; parcelas: number; vencimento: string };
type Entrada = { id: string; descricao: string; valor: number; data: string; recebido?: boolean; recebidoEm?: string };
type Divida = { id: string; nome: string; valor: number; minimo: number; prioridade: number };
type ParcelaProjetada = { key: string; gastoId: string; descricao: string; numero: number; total: number; valor: number; vencimento: string; status: "pendente" | "atrasada" | "paga" | "excluida" };

const RENDA_FIXA = 1000;
const PRIMEIRO_ANO_RENDA = 2026;
const PRIMEIRO_MES_RENDA = 9; // outubro (0 = janeiro)
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function isoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function formatDate(value: string) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function easterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const cc = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(cc / 4);
  const k = cc % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidaySet(year: number) {
  const dates = [
    new Date(year, 0, 1),
    new Date(year, 3, 21),
    new Date(year, 4, 1),
    new Date(year, 8, 7),
    new Date(year, 9, 11), // Criação do Estado de Mato Grosso do Sul
    new Date(year, 9, 12),
    new Date(year, 10, 2),
    new Date(year, 10, 15),
    new Date(year, 10, 20),
    new Date(year, 11, 25),
  ];

  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  dates.push(goodFriday);

  return new Set(dates.map(isoDate));
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  return !holidaySet(date.getFullYear()).has(isoDate(date));
}

function fifthBusinessDay(year: number, month: number) {
  const normalized = new Date(year, month, 1);
  const targetYear = normalized.getFullYear();
  const targetMonth = normalized.getMonth();
  let count = 0;

  for (let day = 1; day <= 31; day++) {
    const date = new Date(targetYear, targetMonth, day);
    if (date.getMonth() !== targetMonth) break;
    if (isBusinessDay(date)) count += 1;
    if (count === 5) return date;
  }

  return new Date(targetYear, targetMonth, 1);
}

function monthIsOnOrAfterFirstIncome(year: number, month: number) {
  return year > PRIMEIRO_ANO_RENDA || (year === PRIMEIRO_ANO_RENDA && month >= PRIMEIRO_MES_RENDA);
}

export default function Page() {
  const [aba, setAba] = useState("painel");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [controleParcelas, setControleParcelas] = useState<Record<string, { pago?: boolean; excluido?: boolean }>>({});
  const [controleCompromissos, setControleCompromissos] = useState<Record<string, { pago?: boolean; pagoEm?: string }>>({});
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      setGastos(JSON.parse(localStorage.getItem("fin_gastos") || "[]"));
      setEntradas(JSON.parse(localStorage.getItem("fin_entradas") || "[]"));
      setDividas(JSON.parse(localStorage.getItem("fin_dividas") || "[]"));
      setControleParcelas(JSON.parse(localStorage.getItem("fin_controle_parcelas") || "{}"));
      setControleCompromissos(JSON.parse(localStorage.getItem("fin_controle_compromissos") || "{}"));
    } catch {}
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    localStorage.setItem("fin_gastos", JSON.stringify(gastos));
    localStorage.setItem("fin_entradas", JSON.stringify(entradas));
    localStorage.setItem("fin_dividas", JSON.stringify(dividas));
    localStorage.setItem("fin_controle_parcelas", JSON.stringify(controleParcelas));
    localStorage.setItem("fin_controle_compromissos", JSON.stringify(controleCompromissos));
  }, [gastos, entradas, dividas, controleParcelas, controleCompromissos, carregado]);

  const totalEntradasRecebidas = useMemo(() => entradas.filter((e) => e.recebido).reduce((s, e) => s + e.valor, 0), [entradas]);
  const totalAReceber = useMemo(() => entradas.filter((e) => !e.recebido).reduce((s, e) => s + e.valor, 0), [entradas]);
  const hoje = new Date();
  const hojeInicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioCiclo = hoje.getDate() >= 10
    ? new Date(hoje.getFullYear(), hoje.getMonth(), 10)
    : new Date(hoje.getFullYear(), hoje.getMonth() - 1, 10);
  const fimCiclo = new Date(inicioCiclo.getFullYear(), inicioCiclo.getMonth() + 1, 9);
  const cicloKey = inicioCiclo.getFullYear() + "-" + String(inicioCiclo.getMonth() + 1).padStart(2, "0");

  const quintoDiaUtilAtual = fifthBusinessDay(hoje.getFullYear(), hoje.getMonth());
  const rendaFixaRecebida =
    monthIsOnOrAfterFirstIncome(hoje.getFullYear(), hoje.getMonth()) &&
    hojeInicio >= quintoDiaUtilAtual
      ? RENDA_FIXA
      : 0;
  const totalFixoRecebido = rendaFixaRecebida;

  const proximosRecebimentosFixos = Array.from({ length: 6 }, (_, index) => {
    let baseYear = hoje.getFullYear();
    let baseMonth = hoje.getMonth();

    if (!monthIsOnOrAfterFirstIncome(baseYear, baseMonth)) {
      baseYear = PRIMEIRO_ANO_RENDA;
      baseMonth = PRIMEIRO_MES_RENDA;
    } else {
      const atual = fifthBusinessDay(baseYear, baseMonth);
      if (hojeInicio >= atual) {
        baseMonth += 1;
        if (baseMonth > 11) {
          baseMonth = 0;
          baseYear += 1;
        }
      }
    }

    const data = fifthBusinessDay(baseYear, baseMonth + index);
    return { data: isoDate(data), valor: RENDA_FIXA };
  });

  const compromissosKeys = {
    solar: "solar_" + cicloKey,
    terapia: "terapia_" + cicloKey,
  };

  const parcelasProjetadas = useMemo<ParcelaProjetada[]>(() => {
    const itens: ParcelaProjetada[] = [];
    for (const g of gastos) {
      const forma = g.forma || "avista";
      const quantidade = forma === "parcelado" ? Math.max(1, g.parcelas || 1) : 1;
      if (!g.vencimento) continue;

      const [ano, mes, dia] = g.vencimento.split("-").map(Number);
      const valorParcela = g.valor / quantidade;

      for (let i = 0; i < quantidade; i++) {
        const data = new Date(ano, mes - 1 + i, dia);
        const yyyy = data.getFullYear();
        const mm = String(data.getMonth() + 1).padStart(2, "0");
        const dd = String(data.getDate()).padStart(2, "0");

        const key = g.id + "__" + (i + 1);
        const controle = controleParcelas[key] || {};
        const vencimento = yyyy + "-" + mm + "-" + dd;
        const vencida = new Date(vencimento + "T00:00:00") < new Date(new Date().toDateString());
        const status = controle.excluido ? "excluida" : controle.pago ? "paga" : vencida ? "atrasada" : "pendente";

        itens.push({
          key,
          gastoId: g.id,
          descricao: g.descricao,
          numero: i + 1,
          total: quantidade,
          valor: valorParcela,
          vencimento,
          status,
        });
      }
    }

    return itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [gastos, controleParcelas]);

  const parcelasAtivas = parcelasProjetadas.filter((p) => p.status !== "excluida");
  const proximasParcelas = parcelasAtivas.filter((p) => p.status === "pendente");
  const parcelasAtrasadas = parcelasAtivas.filter((p) => p.status === "atrasada");
  const parcelasPagas = parcelasAtivas.filter((p) => p.status === "paga");
  const totalParcelasFuturas = proximasParcelas.reduce((s, p) => s + p.valor, 0);
  const totalAtrasado = parcelasAtrasadas.reduce((s, p) => s + p.valor, 0);
  const totalPagoParcelas = parcelasPagas.reduce((s, p) => s + p.valor, 0);
  const totalCompromissosPagos =
    (controleCompromissos[compromissosKeys.solar]?.pago ? 370 : 0) +
    (controleCompromissos[compromissosKeys.terapia]?.pago ? 320 : 0);
  const totalCompromissosPendentes =
    (controleCompromissos[compromissosKeys.solar]?.pago ? 0 : 370) +
    (controleCompromissos[compromissosKeys.terapia]?.pago ? 0 : 320);
  const totalPagoFixo = totalPagoParcelas + totalCompromissosPagos;
  const saldoFixo = totalFixoRecebido - totalPagoFixo;
  const saldoExtra = totalEntradasRecebidas;
  const dinheiroCaixa = saldoFixo + saldoExtra;
  const proximos90Dias = proximasParcelas.filter((p) => {
    const diff = new Date(p.vencimento + "T00:00:00").getTime() - Date.now();
    return diff <= 90 * 24 * 60 * 60 * 1000;
  });
  const total90Dias = proximos90Dias.reduce((s, p) => s + p.valor, 0);

  const plano = useMemo(() => {
    let caixa = Math.max(0, saldoFixo);
    return [...dividas].sort((a, b) => b.prioridade - a.prioridade).map((d) => {
      const base = d.minimo > 0 ? d.minimo : d.valor;
      const pagar = Math.min(caixa, base, d.valor);
      caixa -= pagar;
      return { ...d, pagar };
    });
  }, [dividas, saldoFixo]);

  function addGasto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const descricao = String(f.get("descricao") || "").trim();
    const valor = Number(f.get("valor"));
    const forma = String(f.get("forma") || "avista") as "avista" | "parcelado";
    const parcelas = Math.max(1, Number(f.get("parcelas") || 1));
    const vencimento = String(f.get("vencimento") || "");
    if (!descricao || !Number.isFinite(valor) || valor <= 0) return;
    setGastos((x) => [...x, { id: crypto.randomUUID(), descricao, valor, forma, parcelas, vencimento }]);
    e.currentTarget.reset();
  }

  function addEntrada(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const descricao = String(f.get("descricao") || "").trim();
    const valor = Number(f.get("valor"));
    const data = String(f.get("data") || "");
    if (!descricao || !Number.isFinite(valor) || valor <= 0) return;
    setEntradas((x) => [...x, { id: crypto.randomUUID(), descricao, valor, data, recebido: false }]);
    e.currentTarget.reset();
  }

  function addDivida(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nome = String(f.get("nome") || "").trim();
    const valor = Number(f.get("valor"));
    const minimo = Number(f.get("minimo") || 0);
    const prioridade = Number(f.get("prioridade") || 2);
    if (!nome || !Number.isFinite(valor) || valor <= 0) return;
    setDividas((x) => [...x, { id: crypto.randomUUID(), nome, valor, minimo, prioridade }]);
    e.currentTarget.reset();
  }

  const card = "rounded-3xl border border-[#F8B6D8]/70 bg-white/95 p-5 shadow-sm shadow-[#F8B6D8]/40";
  const field = "mt-1 w-full rounded-xl border border-[#F8B6D8] bg-white px-3 py-3 text-[#4A1F2D] outline-none transition placeholder:text-[#9C7281] focus:border-[#F04AA8] focus:ring-2 focus:ring-[#FFF1F7]";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FFF1F7] via-white to-[#FDEBEC] text-[#4A1F2D]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-[32px] bg-gradient-to-br from-[#F04AA8] via-[#E64B78] to-[#D93A4A] p-6 text-white shadow-lg shadow-[#F8B6D8]/60">
          <p className="text-sm text-[#FFEAF4]">Visão financeira • ciclo do dia 10 ao dia 9</p>
          <h1 className="mt-1 text-3xl font-bold">Minha IA Financeira</h1>
          <p className="mt-2 text-sm text-[#FFEAF4]">Saldo inicial: R$ 0,00. A renda fixa de R$ 1.000,00 entra automaticamente no caixa no 5º dia útil de cada mês, a partir de outubro/2026.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-[#FFEAF4]">Dinheiro em caixa</span><strong className="text-xl">{brl(dinheiroCaixa)}</strong></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-[#FFEAF4]">Extra recebido</span><strong className="text-xl">{brl(totalEntradasRecebidas)}</strong><span className="mt-1 block text-xs text-[#FFEAF4]/80">A receber: {brl(totalAReceber)}</span></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-[#FFEAF4]">Parcelas futuras</span><strong className="text-xl">{brl(totalParcelasFuturas)}</strong></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-[#FFEAF4]">Próx. 90 dias</span><strong className="text-xl">{brl(total90Dias)}</strong></div>
          </div>
        </div>

        <div className="my-5 flex gap-2 overflow-x-auto">
          {[
            ["painel","Painel"],
            ["entradas","Entradas"],
            ["gastos","Gastos"],
            ["dividas","Dívidas atrasadas"],
            ["plano","Plano de pagamento"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              className={"whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium " + (aba === id ? "bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] text-white shadow-sm" : "border border-[#F8B6D8]/70 bg-white text-[#7A3148] hover:bg-[#FFF1F7]")}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "painel" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Resumo titulo="Renda fixa recebida" valor={rendaFixaRecebida} />
              <Resumo titulo="Dinheiro extra recebido" valor={saldoExtra} />
              <Resumo titulo="Entradas extras a receber" valor={totalAReceber} />
              <Resumo titulo="Pago com dinheiro fixo" valor={totalPagoFixo} />
              <Resumo titulo="Parcelas em atraso" valor={totalAtrasado} />
              <Resumo titulo="Dinheiro em caixa" valor={dinheiroCaixa} escuro />
            </div>

            <div className={card}>
              <p className="text-sm text-[#7A5260]">Situação atual</p>
              <h2 className={"mt-1 text-2xl font-bold " + (dinheiroCaixa < 0 ? "text-[#B82F3E]" : dinheiroCaixa < 100 ? "text-[#B82F3E]" : "text-[#C43A72]")}>
                {dinheiroCaixa < 0 ? "Caixa no vermelho" : dinheiroCaixa < 100 ? "Atenção no caixa" : "Caixa disponível"}
              </h2>
              <p className="mt-2 text-sm text-[#6A3B4B]">
                O dinheiro em caixa é {brl(dinheiroCaixa)} e soma tudo que realmente entrou: renda fixa recebida + entradas extras recebidas, descontando os pagamentos já marcados como pagos.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-[#FFF1F7] p-3"><span className="block text-[#7A5260]">Renda fixa recebida</span><strong>{brl(rendaFixaRecebida)}</strong></div>
                <div className="rounded-xl bg-[#FFF1F7] p-3"><span className="block text-[#7A5260]">Extra recebido</span><strong className="text-[#C43A72]">{brl(totalEntradasRecebidas)}</strong></div>
                <div className="rounded-xl bg-[#FDEBEC] p-3"><span className="block text-[#7A5260]">Total em caixa</span><strong className="text-[#D93A4A]">{brl(dinheiroCaixa)}</strong></div>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#4A1F2D]">Próximos pagamentos</h2>
                  <p className="mt-1 text-xs text-[#7A5260]">Parcelas futuras + terapia + placas solares.</p>
                </div>
                <strong>{brl(totalParcelasFuturas + totalAtrasado + totalCompromissosPendentes)}</strong>
              </div>

              {(proximasParcelas.length + parcelasAtrasadas.length + (totalCompromissosPendentes > 0 ? 1 : 0)) === 0 ? (
                <p className="mt-4 text-sm text-[#7A5260]">Nenhum pagamento pendente no momento.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {!controleCompromissos[compromissosKeys.solar]?.pago && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-[#F8B6D8]/70 bg-[#FFF1F7] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">Placas solares</p>
                          <span className="rounded-full bg-[#FDEBEC] px-2.5 py-1 text-xs font-medium text-[#B82F3E]">Fixo mensal</span>
                        </div>
                        <p className="mt-1 text-xs text-[#7A5260]">Vencimento todo dia 10 • pendente</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(370)}</strong>
                        <button
                          type="button"
                          onClick={() => setControleCompromissos((x) => ({...x, [compromissosKeys.solar]: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                          className="rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-3 py-2 text-xs font-medium text-white"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  )}

                  {!controleCompromissos[compromissosKeys.terapia]?.pago && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-[#F8B6D8]/70 bg-[#FFF1F7] p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">Terapia</p>
                          <span className="rounded-full bg-[#FFF1F7] px-2.5 py-1 text-xs font-medium text-[#C43A72]">Fixo mensal</span>
                        </div>
                        <p className="mt-1 text-xs text-[#7A5260]">Vencimento todo dia 10 • 2 sessões por mês • pendente</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(320)}</strong>
                        <button
                          type="button"
                          onClick={() => setControleCompromissos((x) => ({...x, [compromissosKeys.terapia]: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                          className="rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-3 py-2 text-xs font-medium text-white"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  )}

                  {[...parcelasAtrasadas, ...proximasParcelas].slice(0, 8).map((p) => (
                    <div key={p.gastoId + "-" + p.numero} className="flex items-center justify-between rounded-xl bg-[#FFF1F7]/80 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-[#7A5260]">Parcela {p.numero}/{p.total} • {p.vencimento.split("-").reverse().join("/")} • {p.status === "atrasada" ? "Em atraso" : "Pendente"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(p.valor)}</strong>
                        <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], pago: true, excluido: false}}))} className="rounded-lg bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-2.5 py-1.5 text-xs font-medium text-white">Pagar</button>
                        <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], excluido: true, pago: false}}))} className="rounded-lg border border-[#F8B6D8]/70 px-2.5 py-1.5 text-xs font-medium text-[#6A3145]">Excluir</button>
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>


          </div>
        )}

        {aba === "entradas" && (
          <div className="space-y-5">
            <div className={card}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#4A1F2D]">Entradas</h2>
                  <p className="mt-1 text-sm text-[#7A5260]">
                    À esquerda fica a renda fixa projetada. À direita ficam os honorários e demais entradas extras.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[#FFF1F7] px-3 py-2 font-medium text-[#C43A72]">
                    Extra recebido: {brl(totalEntradasRecebidas)}
                  </span>
                  <span className="rounded-full bg-[#FDEBEC] px-3 py-2 font-medium text-[#B82F3E]">
                    A receber: {brl(totalAReceber)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <div className={card}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[#4A1F2D]">Renda fixa projetada</h3>
                      <p className="mt-1 text-sm text-[#7A5260]">
                        R$ 1.000,00 no 5º dia útil de cada mês. O sistema pula sábados, domingos e feriados e adiciona automaticamente ao caixa quando a data chegar.
                      </p>
                    </div>
                    <strong className="text-[#C43A72]">{brl(RENDA_FIXA)}</strong>
                  </div>

                  <div className="mt-4 space-y-3">
                    {proximosRecebimentosFixos.map((item) => (
                      <div key={item.data} className="flex items-center justify-between rounded-2xl border border-[#F8B6D8]/70 bg-[#FFF1F7]/70 p-4">
                        <div>
                          <p className="font-medium">Renda fixa mensal</p>
                          <p className="mt-1 text-xs text-[#7A5260]">5º dia útil calculado: {formatDate(item.data)}</p>
                        </div>
                        <strong>{brl(item.valor)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <form onSubmit={addEntrada} className={card + " space-y-3"}>
                  <div>
                    <h3 className="font-semibold text-[#4A1F2D]">Renda extra</h3>
                    <p className="mt-1 text-sm text-[#7A5260]">
                      Lance honorários ou outros valores. Eles só entram no caixa quando você clicar em Receber.
                    </p>
                  </div>

                  <label className="block text-sm">
                    Descrição
                    <input name="descricao" required className={field} placeholder="Ex.: honorários advocatícios" />
                  </label>

                  <label className="block text-sm">
                    Valor (R$)
                    <input name="valor" required type="number" step="0.01" min="0.01" className={field} />
                  </label>

                  <label className="block text-sm">
                    Data prevista do pagamento
                    <input name="data" type="date" className={field} />
                    <span className="mt-1 block text-xs text-[#7A5260]">
                      Esta data é apenas uma previsão.
                    </span>
                  </label>

                  <button className="w-full rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-4 py-3 font-semibold text-white shadow-sm shadow-[#F8B6D8]/70 transition hover:from-[#E73B99] hover:to-[#C93040]">
                    Adicionar entrada
                  </button>
                </form>

                <div className={card}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-[#4A1F2D]">Rendas extras lançadas</h3>
                      <p className="mt-1 text-sm text-[#7A5260]">
                        Projeção até o momento em que você marcar o recebimento.
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-[#FDEBEC] px-3 py-1.5 font-medium text-[#B82F3E]">
                        A receber: {brl(totalAReceber)}
                      </span>
                      <span className="rounded-full bg-[#FFF1F7] px-3 py-1.5 font-medium text-[#C43A72]">
                        Recebido: {brl(totalEntradasRecebidas)}
                      </span>
                    </div>
                  </div>

                  {entradas.length === 0 ? (
                    <p className="mt-4 text-sm text-[#7A5260]">Nenhuma entrada extra lançada.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {entradas
                        .slice()
                        .sort((a, b) => (a.data || "9999-12-31").localeCompare(b.data || "9999-12-31"))
                        .map((e) => (
                          <div key={e.id} className="rounded-2xl border border-[#F8B6D8]/70 p-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong>{e.descricao}</strong>
                                  <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (e.recebido ? "bg-[#FFF1F7] text-[#C43A72]" : "bg-[#FDEBEC] text-[#B82F3E]")}>
                                    {e.recebido ? "Recebido" : "A receber"}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-[#7A5260]">
                                  {e.data ? "Previsto para " + formatDate(e.data) : "Sem data prevista"}
                                </p>
                                {e.recebido && e.recebidoEm && (
                                  <p className="mt-1 text-xs text-[#C43A72]">Recebido em {formatDate(e.recebidoEm)}</p>
                                )}
                              </div>

                              <div className="flex flex-col gap-3 sm:items-end">
                                <strong className={"text-xl font-bold " + (e.recebido ? "text-[#C43A72]" : "text-[#4A1F2D]")}>
                                  {brl(e.valor)}
                                </strong>
                                <div className="flex gap-2">
                                  {!e.recebido && (
                                    <button
                                      type="button"
                                      onClick={() => setEntradas((x) => x.map((i) => i.id === e.id ? {...i, recebido: true, recebidoEm: new Date().toISOString().slice(0,10)} : i))}
                                      className="rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-4 py-2 text-sm font-medium text-white"
                                    >
                                      Receber
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setEntradas((x) => x.filter((i) => i.id !== e.id))}
                                    className="rounded-xl border border-[#F8B6D8]/70 px-4 py-2 text-sm font-medium text-[#6A3145]"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {aba === "gastos" && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={card + " md:col-span-2"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[#4A1F2D]">Compromissos fixos</h2>
                  <p className="mt-1 text-xs text-[#7A5260]">Vencimento do ciclo: dia 10. Só reduzem o dinheiro fixo quando você clicar em Pagar.</p>
                </div>
                <strong>{brl(690)}</strong>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {[
                  { id: compromissosKeys.solar, nome: "Placas solares", valor: 370, detalhe: "Vencimento todo dia 10" },
                  { id: compromissosKeys.terapia, nome: "Terapia", valor: 320, detalhe: "Vencimento todo dia 10 • 2 sessões por mês" }
                ].map((comp) => {
                  const pago = Boolean(controleCompromissos[comp.id]?.pago);
                  return (
                    <div key={comp.id} className="rounded-2xl border border-[#F8B6D8]/70 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{comp.nome}</p>
                            <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (pago ? "bg-[#FFF1F7] text-[#C43A72]" : "bg-[#FDEBEC] text-[#B82F3E]")}>
                              {pago ? "Pago" : "Pendente"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[#7A5260]">{comp.detalhe}</p>
                          {pago && controleCompromissos[comp.id]?.pagoEm && (
                            <p className="mt-1 text-xs text-[#C43A72]">Pago em {String(controleCompromissos[comp.id]?.pagoEm).split("-").reverse().join("/")}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <strong>{brl(comp.valor)}</strong>
                          {!pago ? (
                            <button
                              type="button"
                              onClick={() => setControleCompromissos((x) => ({...x, [comp.id]: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                              className="rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-3 py-2 text-xs font-medium text-white"
                            >
                              Pagar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setControleCompromissos((x) => ({...x, [comp.id]: {pago: false}}))}
                              className="rounded-xl border border-[#F8B6D8]/70 px-3 py-2 text-xs font-medium text-[#6A3145]"
                            >
                              Desfazer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <form onSubmit={addGasto} className={card + " space-y-3"}>
              <h2 className="text-lg font-semibold text-[#4A1F2D]">Lançar gasto</h2>
              <label className="block text-sm">Descrição<input name="descricao" required className={field} placeholder="Ex.: mercado" /></label>
              <label className="block text-sm">Valor (R$)<input name="valor" required type="number" step="0.01" min="0.01" className={field} /></label>
              <label className="block text-sm">Forma de pagamento
                <select name="forma" defaultValue="avista" className={field}>
                  <option value="avista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </label>
              <label className="block text-sm">Quantidade de parcelas<input name="parcelas" type="number" min="1" defaultValue="1" className={field} /></label>
              <label className="block text-sm">Vencimento da 1ª parcela<input name="vencimento" type="date" className={field} /><span className="mt-1 block text-xs text-[#7A5260]">As demais parcelas serão projetadas mês a mês automaticamente.</span></label>
              <button className="w-full rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-4 py-3 font-semibold text-white shadow-sm shadow-[#F8B6D8]/70 transition hover:from-[#E73B99] hover:to-[#C93040]">Adicionar gasto</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold text-[#4A1F2D]">Gastos deste ciclo</h2>
              {gastos.length === 0 && <p className="mt-3 text-sm text-[#7A5260]">Nenhum gasto lançado.</p>}
              {gastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between border-b border-[#F8B6D8]/50 py-3">
                  <div>
                    <span className="font-medium">{g.descricao}</span>
                    <p className="text-xs text-[#7A5260]">
                      {(g.forma || "avista") === "parcelado" ? "Parcelado em " + (g.parcelas || 1) + "x" : "À vista"}
                      {g.vencimento ? " • vence em " + g.vencimento.split("-").reverse().join("/") : ""}
                    </p>
                  </div>
                  <div>
                    <strong>{brl(g.valor)}</strong>
                    <button type="button" onClick={() => setGastos((x) => x.filter((i) => i.id !== g.id))} className="ml-3 text-xs text-[#B82F3E]">Excluir</button>
                  </div>
                </div>
              ))}
            </div>

            <div className={card + " md:col-span-2"}>
              <h2 className="text-lg font-semibold text-[#4A1F2D]">Projeção das parcelas futuras</h2>
              <p className="mt-1 text-sm text-[#7A5260]">Calendário mensal calculado a partir do vencimento da 1ª parcela.</p>
              {parcelasAtivas.length === 0 ? (
                <p className="mt-3 text-sm text-[#7A5260]">Nenhuma parcela para acompanhar.</p>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {parcelasAtivas.map((p) => (
                    <div key={p.gastoId + "-proj-" + p.numero} className="flex items-center justify-between rounded-xl border border-[#F8B6D8]/70 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-[#7A5260]">Parcela {p.numero}/{p.total} • vence {p.vencimento.split("-").reverse().join("/")} • {p.status === "paga" ? "Paga" : p.status === "atrasada" ? "Em atraso" : "Pendente"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(p.valor)}</strong>
                        {p.status !== "paga" && (
                          <>
                            <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], pago: true, excluido: false}}))} className="rounded-lg bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-2.5 py-1.5 text-xs font-medium text-white">Pagar</button>
                            <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], excluido: true, pago: false}}))} className="rounded-lg border border-[#F8B6D8]/70 px-2.5 py-1.5 text-xs font-medium text-[#6A3145]">Excluir</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {aba === "dividas" && (
          <div className="grid gap-4 md:grid-cols-2">
            <form onSubmit={addDivida} className={card + " space-y-3"}>
              <h2 className="text-lg font-semibold text-[#4A1F2D]">Cadastrar dívida atrasada</h2>
              <label className="block text-sm">Dívida / credor<input name="nome" required className={field} placeholder="Ex.: cartão" /></label>
              <label className="block text-sm">Valor total (R$)<input name="valor" required type="number" step="0.01" min="0.01" className={field} /></label>
              <label className="block text-sm">Parcela mínima possível (R$)<input name="minimo" type="number" step="0.01" min="0" className={field} /></label>
              <label className="block text-sm">Prioridade
                <select name="prioridade" defaultValue="2" className={field}>
                  <option value="3">Alta</option>
                  <option value="2">Média</option>
                  <option value="1">Baixa</option>
                </select>
              </label>
              <button className="w-full rounded-xl bg-gradient-to-r from-[#F04AA8] to-[#D93A4A] px-4 py-3 font-semibold text-white shadow-sm shadow-[#F8B6D8]/70 transition hover:from-[#E73B99] hover:to-[#C93040]">Adicionar dívida</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold text-[#4A1F2D]">Dívidas cadastradas</h2>
              {dividas.length === 0 && <p className="mt-3 text-sm text-[#7A5260]">Nenhuma dívida cadastrada.</p>}
              {dividas.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-[#F8B6D8]/50 py-3">
                  <div>
                    <strong>{d.nome}</strong>
                    <p className="text-xs text-[#7A5260]">Prioridade {d.prioridade === 3 ? "alta" : d.prioridade === 2 ? "média" : "baixa"}</p>
                  </div>
                  <div>
                    <strong>{brl(d.valor)}</strong>
                    <button type="button" onClick={() => setDividas((x) => x.filter((i) => i.id !== d.id))} className="ml-3 text-xs text-[#B82F3E]">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "plano" && (
          <div className="space-y-3">
            <div className={card}>
              <p className="text-sm text-[#7A5260]">Disponível para dívidas</p>
              <p className="mt-1 text-3xl font-bold">{brl(Math.max(0, saldoFixo))}</p>
            </div>

            {saldoFixo <= 0 && <div className="rounded-2xl border border-[#F06A75]/40 bg-[#FDEBEC] p-5 text-[#7E2530]">Não há valor disponível para dívidas neste ciclo sem aumentar o déficit.</div>}
            {saldoFixo > 0 && dividas.length === 0 && <div className={card}>Cadastre suas dívidas atrasadas para gerar a programação.</div>}
            {saldoFixo > 0 && plano.map((p, i) => (
              <div key={p.id} className={card}>
                <span className="rounded-full bg-[#FFF1F7] px-2 py-1 text-xs">Ordem {i + 1}</span>
                <h3 className="mt-3 font-semibold">{p.nome}</h3>
                <p className="mt-1 text-2xl font-bold">{brl(p.pagar)}</p>
                <p className="mt-1 text-sm text-[#7A5260]">Sugestão para separar no próximo dia 10.</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Resumo({ titulo, valor, escuro = false }: { titulo: string; valor: number; escuro?: boolean }) {
  return (
    <div className={"flex min-h-[150px] flex-col justify-between rounded-3xl border p-5 shadow-sm " + (escuro ? "border-[#D93A4A] bg-gradient-to-br from-[#F04AA8] to-[#D93A4A] text-white" : "border-[#F8B6D8]/70 bg-white")}>
      <p className="text-xs opacity-70">{titulo}</p>
      <p className="mt-1 text-xl font-bold">{brl(valor)}</p>
    </div>
  );
}
