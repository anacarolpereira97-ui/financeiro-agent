"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Gasto = { id: string; descricao: string; valor: number };
type Entrada = { id: string; descricao: string; valor: number; data: string };
type Divida = { id: string; nome: string; valor: number; minimo: number; prioridade: number };

const RENDA = 1000;
const FIXOS = 690;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Page() {
  const [aba, setAba] = useState("painel");
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      setGastos(JSON.parse(localStorage.getItem("fin_gastos") || "[]"));
      setEntradas(JSON.parse(localStorage.getItem("fin_entradas") || "[]"));
      setDividas(JSON.parse(localStorage.getItem("fin_dividas") || "[]"));
    } catch {}
    setCarregado(true);
  }, []);

  useEffect(() => {
    if (!carregado) return;
    localStorage.setItem("fin_gastos", JSON.stringify(gastos));
    localStorage.setItem("fin_entradas", JSON.stringify(entradas));
    localStorage.setItem("fin_dividas", JSON.stringify(dividas));
  }, [gastos, entradas, dividas, carregado]);

  const totalGastos = useMemo(() => gastos.reduce((s, g) => s + g.valor, 0), [gastos]);
  const totalEntradas = useMemo(() => entradas.reduce((s, e) => s + e.valor, 0), [entradas]);
  const rendaTotal = RENDA + totalEntradas;
  const saldo = rendaTotal - FIXOS - totalGastos;

  const plano = useMemo(() => {
    let caixa = Math.max(0, saldo);
    return [...dividas].sort((a, b) => b.prioridade - a.prioridade).map((d) => {
      const base = d.minimo > 0 ? d.minimo : d.valor;
      const pagar = Math.min(caixa, base, d.valor);
      caixa -= pagar;
      return { ...d, pagar };
    });
  }, [dividas, saldo]);

  function addGasto(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const descricao = String(f.get("descricao") || "").trim();
    const valor = Number(f.get("valor"));
    if (!descricao || !Number.isFinite(valor) || valor <= 0) return;
    setGastos((x) => [...x, { id: crypto.randomUUID(), descricao, valor }]);
    e.currentTarget.reset();
  }

  function addEntrada(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const descricao = String(f.get("descricao") || "").trim();
    const valor = Number(f.get("valor"));
    const data = String(f.get("data") || "");
    if (!descricao || !Number.isFinite(valor) || valor <= 0) return;
    setEntradas((x) => [...x, { id: crypto.randomUUID(), descricao, valor, data }]);
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

  const card = "rounded-2xl border border-zinc-200 bg-white p-5";
  const field = "mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3";

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-zinc-500">Ciclo do dia 10 ao dia 9</p>
        <h1 className="mt-1 text-3xl font-bold">Minha IA Financeira</h1>
        <p className="mt-2 text-sm text-zinc-600">Renda: R$ 1.000,00 • Placas solares: R$ 370,00 • Terapia: R$ 320,00/mês</p>

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
              className={"whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium " + (aba === id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white")}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "painel" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Resumo titulo="Renda total" valor={rendaTotal} />
              <Resumo titulo="Entradas extras" valor={totalEntradas} />
              <Resumo titulo="Fixos" valor={FIXOS} />
              <Resumo titulo="Gastos" valor={totalGastos} />
              <Resumo titulo="Saldo" valor={saldo} escuro />
            </div>

            <div className={card}>
              <p className="text-sm text-zinc-500">Situação atual</p>
              <h2 className={"mt-1 text-2xl font-bold " + (saldo < 0 ? "text-red-700" : saldo < 100 ? "text-amber-700" : "text-emerald-700")}>
                {saldo < 0 ? "No vermelho" : saldo < 100 ? "Atenção" : "No azul"}
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                {saldo < 0 ? "Você ultrapassou sua renda em " + brl(Math.abs(saldo)) + "." : "Você ainda tem " + brl(saldo) + " disponível neste ciclo."}
              </p>
            </div>

            <div className={card}>
              <h2 className="font-semibold">Compromissos cadastrados</h2>
              <div className="mt-3 flex justify-between border-b border-zinc-100 pb-3"><span>Placas solares</span><strong>R$ 370,00</strong></div>
              <div className="mt-3 flex justify-between"><span>Terapia (2 × R$ 160)</span><strong>R$ 320,00</strong></div>
            </div>
          </div>
        )}

        {aba === "entradas" && (
          <div className="grid gap-4 md:grid-cols-2">
            <form onSubmit={addEntrada} className={card + " space-y-3"}>
              <h2 className="text-lg font-semibold">Lançar entrada de dinheiro</h2>
              <label className="block text-sm">Descrição<input name="descricao" required className={field} placeholder="Ex.: honorários advocatícios" /></label>
              <label className="block text-sm">Valor (R$)<input name="valor" required type="number" step="0.01" min="0.01" className={field} /></label>
              <label className="block text-sm">Data<input name="data" type="date" className={field} /></label>
              <button className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white">Adicionar entrada</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Entradas extras deste ciclo</h2>
              <p className="mt-1 text-sm text-zinc-500">Salário fixo mensal: {brl(RENDA)}</p>
              {entradas.length === 0 && <p className="mt-3 text-sm text-zinc-500">Nenhuma entrada extra lançada.</p>}
              {entradas.map((e) => (
                <div key={e.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <div>
                    <strong>{e.descricao}</strong>
                    {e.data && <p className="text-xs text-zinc-500">{e.data.split("-").reverse().join("/")}</p>}
                  </div>
                  <div>
                    <strong className="text-emerald-700">+ {brl(e.valor)}</strong>
                    <button type="button" onClick={() => setEntradas((x) => x.filter((i) => i.id !== e.id))} className="ml-3 text-xs text-red-700">Excluir</button>
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
              <button className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white">Adicionar gasto</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Gastos deste ciclo</h2>
              {gastos.length === 0 && <p className="mt-3 text-sm text-zinc-500">Nenhum gasto lançado.</p>}
              {gastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <span>{g.descricao}</span>
                  <div>
                    <strong>{brl(g.valor)}</strong>
                    <button type="button" onClick={() => setGastos((x) => x.filter((i) => i.id !== g.id))} className="ml-3 text-xs text-red-700">Excluir</button>
                  </div>
                </div>
              ))}
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
              <button className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white">Adicionar dívida</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Dívidas cadastradas</h2>
              {dividas.length === 0 && <p className="mt-3 text-sm text-zinc-500">Nenhuma dívida cadastrada.</p>}
              {dividas.map((d) => (
                <div key={d.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <div>
                    <strong>{d.nome}</strong>
                    <p className="text-xs text-zinc-500">Prioridade {d.prioridade === 3 ? "alta" : d.prioridade === 2 ? "média" : "baixa"}</p>
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
              <p className="text-sm text-zinc-500">Disponível para dívidas</p>
              <p className="mt-1 text-3xl font-bold">{brl(Math.max(0, saldo))}</p>
            </div>

            {saldo <= 0 && <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900">Não há valor disponível para dívidas neste ciclo sem aumentar o déficit.</div>}
            {saldo > 0 && dividas.length === 0 && <div className={card}>Cadastre suas dívidas atrasadas para gerar a programação.</div>}
            {saldo > 0 && plano.map((p, i) => (
              <div key={p.id} className={card}>
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">Ordem {i + 1}</span>
                <h3 className="mt-3 font-semibold">{p.nome}</h3>
                <p className="mt-1 text-2xl font-bold">{brl(p.pagar)}</p>
                <p className="mt-1 text-sm text-zinc-500">Sugestão para separar no próximo dia 10.</p>
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
    <div className={"rounded-2xl border p-4 " + (escuro ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-200 bg-white")}>
      <p className="text-xs opacity-70">{titulo}</p>
      <p className="mt-1 text-xl font-bold">{brl(valor)}</p>
    </div>
  );
}
