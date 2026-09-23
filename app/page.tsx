"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Gasto = { id: string; descricao: string; valor: number; forma: "avista" | "parcelado"; parcelas: number; vencimento: string };
type Entrada = { id: string; descricao: string; valor: number; data: string };
type Divida = { id: string; nome: string; valor: number; minimo: number; prioridade: number };
type ParcelaProjetada = { gastoId: string; descricao: string; numero: number; total: number; valor: number; vencimento: string };

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
  const hoje = new Date();
  const inicioRenda = new Date(PRIMEIRO_RECEBIMENTO + "T00:00:00");
  const rendaFixaRecebida = hoje >= inicioRenda ? RENDA_FIXA : 0;
  const entradaProgramadaRecebida = hoje >= inicioRenda ? ENTRADA_PROGRAMADA : 0;
  const rendaTotal = rendaFixaRecebida + entradaProgramadaRecebida + totalEntradas;
  const saldo = rendaTotal - totalGastos;

  const parcelasProjetadas = useMemo<ParcelaProjetada[]>(() => {
    const itens: ParcelaProjetada[] = [];
    for (const g of gastos) {
      const forma = g.forma || "avista";
      const quantidade = Math.max(1, g.parcelas || 1);
      if (forma !== "parcelado" || !g.vencimento || quantidade <= 1) continue;

      const [ano, mes, dia] = g.vencimento.split("-").map(Number);
      const valorParcela = g.valor / quantidade;

      for (let i = 0; i < quantidade; i++) {
        const data = new Date(ano, mes - 1 + i, dia);
        const yyyy = data.getFullYear();
        const mm = String(data.getMonth() + 1).padStart(2, "0");
        const dd = String(data.getDate()).padStart(2, "0");

        itens.push({
          gastoId: g.id,
          descricao: g.descricao,
          numero: i + 1,
          total: quantidade,
          valor: valorParcela,
          vencimento: yyyy + "-" + mm + "-" + dd,
        });
      }
    }

    return itens.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [gastos]);

  const proximasParcelas = parcelasProjetadas.filter((p) => new Date(p.vencimento + "T00:00:00") >= new Date(new Date().toDateString()));
  const totalParcelasFuturas = proximasParcelas.reduce((s, p) => s + p.valor, 0);
  const proximos90Dias = proximasParcelas.filter((p) => {
    const diff = new Date(p.vencimento + "T00:00:00").getTime() - Date.now();
    return diff <= 90 * 24 * 60 * 60 * 1000;
  });
  const total90Dias = proximos90Dias.reduce((s, p) => s + p.valor, 0);

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
        <div className="rounded-3xl bg-zinc-950 p-6 text-white shadow-sm">
          <p className="text-sm text-zinc-300">Visão financeira • ciclo do dia 10 ao dia 9</p>
          <h1 className="mt-1 text-3xl font-bold">Minha IA Financeira</h1>
          <p className="mt-2 text-sm text-zinc-300">Saldo inicial: R$ 0,00. Em 10/10/2026 entram R$ 1.000,00 de renda fixa + R$ 2.300,00 programados.</p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-zinc-300">Saldo atual</span><strong className="text-xl">{brl(saldo)}</strong></div>
            <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-zinc-300">Extras lançados</span><strong className="text-xl">{brl(totalEntradas)}</strong></div>
            <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-zinc-300">Parcelas futuras</span><strong className="text-xl">{brl(totalParcelasFuturas)}</strong></div>
            <div className="rounded-2xl bg-white/10 p-3"><span className="block text-xs text-zinc-300">Próx. 90 dias</span><strong className="text-xl">{brl(total90Dias)}</strong></div>
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
              className={"whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium " + (aba === id ? "bg-zinc-950 text-white" : "border border-zinc-200 bg-white")}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === "painel" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Resumo titulo="Renda fixa recebida" valor={rendaFixaRecebida} />
              <Resumo titulo="R$ 2.300 programados" valor={entradaProgramadaRecebida} />
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
                {saldo < 0 ? "Você ultrapassou sua renda disponível em " + brl(Math.abs(saldo)) + "." : "Você ainda tem " + brl(saldo) + " disponível neste ciclo."}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl bg-zinc-100 p-3"><span className="block text-zinc-500">Renda fixa recebida</span><strong>{brl(rendaFixaRecebida)}</strong></div>
                <div className="rounded-xl bg-zinc-100 p-3"><span className="block text-zinc-500">Entrada programada</span><strong>{brl(entradaProgramadaRecebida)}</strong></div>
                <div className="rounded-xl bg-emerald-50 p-3"><span className="block text-zinc-500">Entradas extras</span><strong className="text-emerald-700">{brl(totalEntradas)}</strong></div>
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Próximas parcelas a vencer</h2>
                  <p className="mt-1 text-xs text-zinc-500">Projeção automática dos gastos parcelados cadastrados.</p>
                </div>
                <strong>{brl(totalParcelasFuturas)}</strong>
              </div>

              {proximasParcelas.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">Nenhuma parcela futura cadastrada.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {proximasParcelas.slice(0, 6).map((p) => (
                    <div key={p.gastoId + "-" + p.numero} className="flex items-center justify-between rounded-xl bg-zinc-50 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-zinc-500">Parcela {p.numero}/{p.total} • {p.vencimento.split("-").reverse().join("/")}</p>
                      </div>
                      <strong>{brl(p.valor)}</strong>
                    </div>
                  ))}
                  {proximasParcelas.length > 6 && (
                    <p className="pt-1 text-xs text-zinc-500">+ {proximasParcelas.length - 6} parcela(s) futura(s).</p>
                  )}
                </div>
              )}
            </div>

            <div className={card}>
              <h2 className="font-semibold">Compromissos cadastrados</h2>
              <p className="mt-2 text-xs text-zinc-500">Estes valores são compromissos previstos e não são descontados automaticamente antes do pagamento. Lance o pagamento em Gastos quando ele ocorrer.</p>
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
              <p className="mt-1 text-sm text-zinc-500">Aqui aparecem somente valores avulsos. Sua renda fixa de {brl(RENDA_FIXA)} só entra no saldo a partir de 10/10/2026.</p>
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
              <label className="block text-sm">Forma de pagamento
                <select name="forma" defaultValue="avista" className={field}>
                  <option value="avista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </label>
              <label className="block text-sm">Quantidade de parcelas<input name="parcelas" type="number" min="1" defaultValue="1" className={field} /></label>
              <label className="block text-sm">Vencimento da 1ª parcela<input name="vencimento" type="date" className={field} /><span className="mt-1 block text-xs text-zinc-500">As demais parcelas serão projetadas mês a mês automaticamente.</span></label>
              <button className="w-full rounded-xl bg-zinc-950 px-4 py-3 font-semibold text-white">Adicionar gasto</button>
            </form>

            <div className={card}>
              <h2 className="text-lg font-semibold">Gastos deste ciclo</h2>
              {gastos.length === 0 && <p className="mt-3 text-sm text-zinc-500">Nenhum gasto lançado.</p>}
              {gastos.map((g) => (
                <div key={g.id} className="flex items-center justify-between border-b border-zinc-100 py-3">
                  <div>
                    <span className="font-medium">{g.descricao}</span>
                    <p className="text-xs text-zinc-500">
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
              <p className="mt-1 text-sm text-zinc-500">Calendário mensal calculado a partir do vencimento da 1ª parcela.</p>
              {proximasParcelas.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">Nenhuma parcela futura para projetar.</p>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {proximasParcelas.map((p) => (
                    <div key={p.gastoId + "-proj-" + p.numero} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3">
                      <div>
                        <p className="text-sm font-medium">{p.descricao}</p>
                        <p className="text-xs text-zinc-500">Parcela {p.numero}/{p.total} • vence {p.vencimento.split("-").reverse().join("/")}</p>
                      </div>
                      <strong>{brl(p.valor)}</strong>
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
