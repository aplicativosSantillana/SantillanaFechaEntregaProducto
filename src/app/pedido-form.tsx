"use client";

import { useState } from "react";

type TipoPedido = "venta" | "consignacion";

const PREFIJOS: Record<TipoPedido, string> = {
  venta: "VP-",
  consignacion: "PT-",
};

export function PedidoForm() {
  const [tipoPedido, setTipoPedido] = useState<TipoPedido | null>(null);
  const [digitos, setDigitos] = useState("");

  const prefijo = tipoPedido ? PREFIJOS[tipoPedido] : "";

  function seleccionarTipo(tipo: TipoPedido) {
    setTipoPedido(tipo);
    setDigitos("");
  }

  function onDigitosChange(value: string) {
    setDigitos(value.replace(/\D/g, "").slice(0, 6));
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
        Nuevo pedido
      </h1>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          Tipo de pedido
        </span>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => seleccionarTipo("venta")}
            className={`flex-1 rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
              tipoPedido === "venta"
                ? "border-transparent bg-foreground text-background"
                : "border-black/[.08] text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
            }`}
          >
            Pedido Venta
          </button>
          <button
            type="button"
            onClick={() => seleccionarTipo("consignacion")}
            className={`flex-1 rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
              tipoPedido === "consignacion"
                ? "border-transparent bg-foreground text-background"
                : "border-black/[.08] text-black hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
            }`}
          >
            Pedido Consignación
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="numeroPedido"
          className="text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          No. Pedido
        </label>
        <div className="flex items-stretch overflow-hidden rounded-md border border-black/[.08] focus-within:border-zinc-400 dark:border-white/[.145]">
          <span className="flex items-center bg-black/[.04] px-3 font-mono text-sm text-zinc-600 dark:bg-white/[.06] dark:text-zinc-400">
            {prefijo || "—"}
          </span>
          <input
            id="numeroPedido"
            name="numeroPedido"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            disabled={!tipoPedido}
            value={digitos}
            onChange={(e) => onDigitosChange(e.target.value)}
            className="w-full bg-transparent px-3 py-2 font-mono text-black outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-zinc-50"
          />
        </div>
        {!tipoPedido && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Selecciona un tipo de pedido para habilitar este campo.
          </p>
        )}
      </div>

      {tipoPedido && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pedido:{" "}
          <span className="font-mono font-medium text-black dark:text-zinc-50">
            {prefijo}
            {digitos || "______"}
          </span>
        </p>
      )}
    </div>
  );
}
