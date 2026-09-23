"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Gasto = { id: string; descricao: string; valor: number; forma: "avista" | "parcelado"; parcelas: number; vencimento: string };
type Entrada = { id: string; descricao: string; valor: number; data: string; recebido?: boolean; recebidoEm?: string };
type Divida = { id: string; nome: string; valor: number; minimo: number; prioridade: number };
type ParcelaProjetada = { key: string; gastoId: string; descricao: string; numero: number; total: number; valor: number; vencimento: string; status: "pendente" | "atrasada" | "paga" | "excluida" };

const RENDA_FIXA = 1000;
const ENTRADA_PROGRAMADA = 2300;
const PRIMEIRO_RECEBIMENTO = "2026-10-10";
const FIXOS = 690;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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

  const totalEntradasLancadas = useMemo(() => entradas.reduce((s, e) => s + e.valor, 0), [entradas]);
  const totalEntradasRecebidas = useMemo(() => entradas.filter((e) => e.recebido).reduce((s, e) => s + e.valor, 0), [entradas]);
  const totalAReceber = useMemo(() => entradas.filter((e) => !e.recebido).reduce((s, e) => s + e.valor, 0), [entradas]);
  const hoje = new Date();
  const inicioRenda = new Date(PRIMEIRO_RECEBIMENTO + "T00:00:00");
  const rendaFixaRecebida = hoje >= inicioRenda ? RENDA_FIXA : 0;
  const entradaProgramadaRecebida = hoje >= inicioRenda ? ENTRADA_PROGRAMADA : 0;
  const totalFixoRecebido = rendaFixaRecebida + entradaProgramadaRecebida;

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
    (controleCompromissos.solar?.pago ? 370 : 0) +
    (controleCompromissos.terapia?.pago ? 320 : 0);
  const totalCompromissosPendentes =
    (controleCompromissos.solar?.pago ? 0 : 370) +
    (controleCompromissos.terapia?.pago ? 0 : 320);
  const totalPagoFixo = totalPagoParcelas + totalCompromissosPagos;
  const saldoFixo = totalFixoRecebido - totalPagoFixo;
  const saldoExtra = totalEntradasRecebidas;
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

  const card = "rounded-3xl border border-rose-100 bg-white/95 p-5 shadow-sm shadow-rose-100/60";
  const field = "mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-3 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-red-50 text-rose-950">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="rounded-[32px] bg-gradient-to-br from-rose-500 via-rose-600 to-red-500 p-6 text-white shadow-lg shadow-rose-200/60">
          <p className="text-sm text-rose-100">Visão financeira • ciclo do dia 10 ao dia 9</p>
          <h1 className="mt-1 text-3xl font-bold">Minha IA Financeira</h1>
          <p className="mt-2 text-sm text-rose-100">Saldo inicial: R$ 0,00. Em 10/10/2026 entram R$ 1.000,00 de renda fixa + R$ 2.300,00 programados.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-rose-100">Saldo atual</span><strong className="text-xl">{brl(saldoFixo)}</strong></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-rose-100">Extra recebido</span><strong className="text-xl">{brl(totalEntradasRecebidas)}</strong><span className="mt-1 block text-xs text-rose-100/80">A receber: {brl(totalAReceber)}</span></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-rose-100">Parcelas futuras</span><strong className="text-xl">{brl(totalParcelasFuturas)}</strong></div>
            <div className="rounded-2xl bg-white/15 p-3"><span className="block text-xs text-rose-100">Próx. 90 dias</span><strong className="text-xl">{brl(total90Dias)}</strong></div>
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
              className={"whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium " + (aba === id ? "bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-sm" : "border border-rose-100 bg-white text-rose-800 hover:bg-rose-50")}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "painel" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Resumo titulo="Renda fixa recebida" valor={rendaFixaRecebida} />
              <Resumo titulo="R$ 2.300 programados" valor={entradaProgramadaRecebida} />
              <Resumo titulo="Dinheiro extra recebido" valor={saldoExtra} />
              <Resumo titulo="Entradas extras a receber" valor={totalAReceber} />
              <Resumo titulo="Pago com dinheiro fixo" valor={totalPagoFixo} />
              <Resumo titulo="Parcelas em atraso" valor={totalAtrasado} />
              <Resumo titulo="Saldo do dinheiro fixo" valor={saldoFixo} escuro />
            </div>

            <div className={card}>
              <p className="text-sm text-rose-700/70">Situação atual</p>
              <h2 className={"mt-1 text-2xl font-bold " + (saldoFixo < 0 ? "text-red-700" : saldoFixo < 100 ? "text-red-700" : "text-rose-700")}>
                {saldoFixo < 0 ? "Fixos no vermelho" : saldoFixo < 100 ? "Atenção no fixo" : "Fixos sob controle"}
              </h2>
              <p className="mt-2 text-sm text-rose-800/75">
                O dinheiro extra disponível é {brl(saldoExtra)}. Entradas apenas lançadas ficam em “A receber” e só entram no caixa quando você clicar em Receber.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-rose-100/70 p-3"><span className="block text-rose-700/70">Renda fixa recebida</span><strong>{brl(rendaFixaRecebida)}</strong></div>
                <div className="rounded-xl bg-rose-100/70 p-3"><span className="block text-rose-700/70">Entrada programada</span><strong>{brl(entradaProgramadaRecebida)}</strong></div>
                <div className="rounded-xl bg-rose-50 p-3"><span className="block text-rose-700/70">Extra recebido</span><strong className="text-rose-700">{brl(totalEntradasRecebidas)}</strong></div>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Próximos pagamentos</h2>
                  <p className="mt-1 text-xs text-rose-700/70">Parcelas futuras + terapia + placas solares.</p>
                </div>
                <strong>{brl(totalParcelasFuturas + totalAtrasado + totalCompromissosPendentes)}</strong>
              </div>

              {(proximasParcelas.length + parcelasAtrasadas.length + (totalCompromissosPendentes > 0 ? 1 : 0)) === 0 ? (
                <p className="mt-4 text-sm text-rose-700/70">Nenhum pagamento pendente no momento.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {!controleCompromissos.solar?.pago && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">Placas solares</p>
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">Fixo mensal</span>
                        </div>
                        <p className="mt-1 text-xs text-rose-700/70">Compromisso fixo • pendente</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(370)}</strong>
                        <button
                          type="button"
                          onClick={() => setControleCompromissos((x) => ({...x, solar: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                          className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-3 py-2 text-xs font-medium text-white"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  )}

                  {!controleCompromissos.terapia?.pago && (
                    <div className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">Terapia</p>
                          <span className="rounded-full bg-pink-50 px-2.5 py-1 text-xs font-medium text-pink-700">Fixo mensal</span>
                        </div>
                        <p className="mt-1 text-xs text-rose-700/70">2 sessões por mês • pendente</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(320)}</strong>
                        <button
                          type="button"
                          onClick={() => setControleCompromissos((x) => ({...x, terapia: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                          className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-3 py-2 text-xs font-medium text-white"
                        >
                          Pagar
                        </button>
                      </div>
                    </div>
                  )}

                  {[...parcelasAtrasadas, ...proximasParcelas].slice(0, 8).map((p) => (
                    <div key={p.gastoId + "-" + p.numero} className="flex items-center justify-between rounded-xl bg-rose-50/60 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-rose-700/70">Parcela {p.numero}/{p.total} • {p.vencimento.split("-").reverse().join("/")} • {p.status === "atrasada" ? "Em atraso" : "Pendente"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(p.valor)}</strong>
                        <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], pago: true, excluido: false}}))} className="rounded-lg bg-gradient-to-r from-rose-500 to-red-500 px-2.5 py-1.5 text-xs font-medium text-white">Pagar</button>
                        <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], excluido: true, pago: false}}))} className="rounded-lg border border-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-800">Excluir</button>
                      </div>
                    </div>
                  ))}

                </div>
              )}
            </div>

            <div className={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-rose-950">Compromissos fixos</h2>
                  <p className="mt-1 text-xs text-rose-700/70">Só reduzem o dinheiro fixo quando você clicar em Pagar.</p>
                </div>
                <strong>{brl(690)}</strong>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { id: "solar", nome: "Placas solares", valor: 370, detalhe: "Compromisso mensal" },
                  { id: "terapia", nome: "Terapia", valor: 320, detalhe: "2 sessões por mês" }
                ].map((comp) => {
                  const pago = Boolean(controleCompromissos[comp.id]?.pago);
                  return (
                    <div key={comp.id} className="rounded-2xl border border-rose-100 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{comp.nome}</p>
                            <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (pago ? "bg-rose-50 text-rose-700" : "bg-red-50/70 text-red-700")}>
                              {pago ? "Pago" : "Pendente"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-rose-700/70">{comp.detalhe}</p>
                          {pago && controleCompromissos[comp.id]?.pagoEm && (
                            <p className="mt-1 text-xs text-rose-700">Pago em {String(controleCompromissos[comp.id]?.pagoEm).split("-").reverse().join("/")}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <strong>{brl(comp.valor)}</strong>
                          {!pago ? (
                            <button
                              type="button"
                              onClick={() => setControleCompromissos((x) => ({...x, [comp.id]: {pago: true, pagoEm: new Date().toISOString().slice(0,10)}}))}
                              className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-3 py-2 text-xs font-medium text-white"
                            >
                              Pagar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setControleCompromissos((x) => ({...x, [comp.id]: {pago: false}}))}
                              className="rounded-xl border border-rose-100 px-3 py-2 text-xs font-medium text-rose-800"
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
          </div>
        )}

        {aba === "entradas" && (
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <form onSubmit={addEntrada} className={card + " space-y-3"}>
              <h2 className="text-lg font-semibold">Lançar entrada de dinheiro</h2>
              <label className="block text-sm">Descrição<input name="descricao" required className={field} placeholder="Ex.: honorários advocatícios" /></label>
              <label className="block text-sm">Valor (R$)<input name="valor" required type="number" step="0.01" min="0.01" className={field} /></label>
              <label className="block text-sm">Data prevista do pagamento<input name="data" type="date" className={field} /><span className="mt-1 block text-xs text-rose-700/70">Esta data é apenas uma previsão. O valor só entra no caixa quando você clicar em Receber.</span></label>
              <button className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 font-semibold text-white shadow-sm shadow-rose-200 transition hover:from-rose-600 hover:to-red-600">Adicionar entrada</button>
            </form>

            <div className={card}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Entradas extras</h2>
                  <p className="mt-1 text-sm text-rose-700/70">Lançar não altera o caixa. Clique em Receber quando o pagamento realmente entrar.</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full bg-red-50 px-3 py-1.5 font-medium text-red-700">A receber: {brl(totalAReceber)}</span>
                  <span className="rounded-full bg-pink-50 px-3 py-1.5 font-medium text-pink-700">Recebido: {brl(totalEntradasRecebidas)}</span>
                </div>
              </div>
              {entradas.length === 0 && <p className="mt-3 text-sm text-rose-700/70">Nenhuma entrada extra lançada.</p>}
              {entradas.map((e) => (
                <div key={e.id} className="rounded-2xl border border-rose-100 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{e.descricao}</strong>
                      <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (e.recebido ? "bg-rose-50 text-rose-700" : "bg-red-50/70 text-red-700")}>
                        {e.recebido ? "Recebido" : "A receber"}
                      </span>
                    </div>
                    {e.data && <p className="mt-1 text-xs text-rose-700/70">Previsto para {e.data.split("-").reverse().join("/")}</p>}
                    {e.recebido && e.recebidoEm && <p className="mt-1 text-xs text-rose-700">Recebido em {e.recebidoEm.split("-").reverse().join("/")}</p>}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <strong className={"text-2xl font-bold " + (e.recebido ? "text-rose-700" : "text-rose-950")}>{brl(e.valor)}</strong>
                    <div className="flex flex-nowrap gap-2">
                      {!e.recebido && (
                        <button
                          type="button"
                          onClick={() => setEntradas((x) => x.map((i) => i.id === e.id ? {...i, recebido: true, recebidoEm: new Date().toISOString().slice(0,10)} : i))}
                          className="rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-medium text-white"
                        >
                          Receber
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEntradas((x) => x.filter((i) => i.id !== e.id))}
                        className="rounded-xl border border-rose-100 px-4 py-2 text-sm font-medium text-rose-800"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "gastos" && (
          <div className="grid gap-4 md:grid-cols-2">
            <form onSubmit={addGasto} className={card + " space-y-3"}>
              <h2 className="text-lg font-semibold">Lançar gasto</h2>
              <label className="block text-sm">Descrição<input name="descricao" required className={field} placeholder="Ex.: mercado" /></label>
              <label className="block text-sm">Valor (R$)<input name="valor" required type="number" step="0.01" min="0.01" className={field} /></label>
              <label className="block text-sm">Forma de pagamento
                <select name="forma" defaultValue="avista" className={field}>
                  <option value="avista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </label>
              <label className="block text-sm">Quantidade de parcelas<input name="parcelas" type="number" min="1" defaultValue="1" className={field} /></label>
              <label className="block text-sm">Vencimento da 1ª parcela<input name="vencimento" type="date" className={field} /><span className="mt-1 block text-xs text-rose-700/70">As demais parcelas serão projetadas mês a mês automaticamente.</span></label>
              <button className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 font-semibold text-white shadow-sm shadow-rose-200 transition hover:from-rose-600 hover:to-red-600">Adicionar gasto</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Gastos deste ciclo</h2>
              {gastos.length === 0 && <p className="mt-3 text-sm text-rose-700/70">Nenhum gasto lançado.</p>}
              {gastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <div>
                    <span className="font-medium">{g.descricao}</span>
                    <p className="text-xs text-rose-700/70">
                      {(g.forma || "avista") === "parcelado" ? "Parcelado em " + (g.parcelas || 1) + "x" : "À vista"}
                      {g.vencimento ? " • vence em " + g.vencimento.split("-").reverse().join("/") : ""}
                    </p>
                  </div>
                  <div>
                    <strong>{brl(g.valor)}</strong>
                    <button type="button" onClick={() => setGastos((x) => x.filter((i) => i.id !== g.id))} className="ml-3 text-xs text-red-700">Excluir</button>
                  </div>
                </div>
              ))}
            </div>

            <div className={card + " md:col-span-2"}>
              <h2 className="text-lg font-semibold">Projeção das parcelas futuras</h2>
              <p className="mt-1 text-sm text-rose-700/70">Calendário mensal calculado a partir do vencimento da 1ª parcela.</p>
              {parcelasAtivas.length === 0 ? (
                <p className="mt-3 text-sm text-rose-700/70">Nenhuma parcela para acompanhar.</p>
              ) : (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {parcelasAtivas.map((p) => (
                    <div key={p.gastoId + "-proj-" + p.numero} className="flex items-center justify-between rounded-xl border border-rose-100 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-rose-700/70">Parcela {p.numero}/{p.total} • vence {p.vencimento.split("-").reverse().join("/")} • {p.status === "paga" ? "Paga" : p.status === "atrasada" ? "Em atraso" : "Pendente"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong>{brl(p.valor)}</strong>
                        {p.status !== "paga" && (
                          <>
                            <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], pago: true, excluido: false}}))} className="rounded-lg bg-gradient-to-r from-rose-500 to-red-500 px-2.5 py-1.5 text-xs font-medium text-white">Pagar</button>
                            <button type="button" onClick={() => setControleParcelas((x) => ({...x, [p.key]: {...x[p.key], excluido: true, pago: false}}))} className="rounded-lg border border-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-800">Excluir</button>
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
              <h2 className="text-lg font-semibold">Cadastrar dívida atrasada</h2>
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
              <button className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-red-500 px-4 py-3 font-semibold text-white shadow-sm shadow-rose-200 transition hover:from-rose-600 hover:to-red-600">Adicionar dívida</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Dívidas cadastradas</h2>
              {dividas.length === 0 && <p className="mt-3 text-sm text-rose-700/70">Nenhuma dívida cadastrada.</p>}
              {dividas.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <div>
                    <strong>{d.nome}</strong>
                    <p className="text-xs text-rose-700/70">Prioridade {d.prioridade === 3 ? "alta" : d.prioridade === 2 ? "média" : "baixa"}</p>
                  </div>
                  <div>
                    <strong>{brl(d.valor)}</strong>
                    <button type="button" onClick={() => setDividas((x) => x.filter((i) => i.id !== d.id))} className="ml-3 text-xs text-red-700">Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === "plano" && (
          <div className="space-y-3">
            <div className={card}>
              <p className="text-sm text-rose-700/70">Disponível para dívidas</p>
              <p className="mt-1 text-3xl font-bold">{brl(Math.max(0, saldoFixo))}</p>
            </div>

            {saldoFixo <= 0 && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">Não há valor disponível para dívidas neste ciclo sem aumentar o déficit.</div>}
            {saldoFixo > 0 && dividas.length === 0 && <div className={card}>Cadastre suas dívidas atrasadas para gerar a programação.</div>}
            {saldoFixo > 0 && plano.map((p, i) => (
              <div key={p.id} className={card}>
                <span className="rounded-full bg-rose-100/70 px-2 py-1 text-xs">Ordem {i + 1}</span>
                <h3 className="mt-3 font-semibold">{p.nome}</h3>
                <p className="mt-1 text-2xl font-bold">{brl(p.pagar)}</p>
                <p className="mt-1 text-sm text-rose-700/70">Sugestão para separar no próximo dia 10.</p>
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
    <div className={"flex min-h-[150px] flex-col justify-between rounded-3xl border p-5 shadow-sm " + (escuro ? "border-zinc-950 bg-gradient-to-r from-rose-500 to-red-500 text-white" : "border-rose-100 bg-white")}>
      <p className="text-xs opacity-70">{titulo}</p>
      <p className="mt-1 text-xl font-bold">{brl(valor)}</p>
    </div>
  );
}
