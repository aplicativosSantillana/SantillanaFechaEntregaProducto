"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ClienteResumen = {
  clienteKey: string;
  nombreCliente: string;
  codCliente: string;
  direccionEnvio: string;
  totalPedidos: number;
  pendientes: number;
};

function coincide(cliente: ClienteResumen, filtro: string): boolean {
  if (!filtro) return true;
  const texto = filtro.toLowerCase();
  return (
    cliente.nombreCliente.toLowerCase().includes(texto) ||
    cliente.codCliente.toLowerCase().includes(texto)
  );
}

function TarjetaCliente({ cliente }: { cliente: ClienteResumen }) {
  return (
    <Link
      href={`/mis-rutas?cliente=${encodeURIComponent(cliente.clienteKey)}`}
      className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-[#1a1a1a]"
    >
      <div>
        <p className="font-medium text-black dark:text-zinc-50">
          {cliente.nombreCliente || cliente.codCliente}
        </p>
        {cliente.codCliente && (
          <p className="text-xs text-zinc-500">{cliente.codCliente}</p>
        )}
        {cliente.direccionEnvio && (
          <p className="text-xs text-zinc-500">{cliente.direccionEnvio}</p>
        )}
      </div>
      <span
        className={
          cliente.pendientes > 0
            ? "text-xs font-medium text-amber-700 dark:text-amber-400"
            : "text-xs font-medium text-emerald-700 dark:text-emerald-400"
        }
      >
        {cliente.pendientes > 0
          ? `${cliente.pendientes} de ${cliente.totalPedidos} pendientes`
          : "Todo entregado"}
      </span>
    </Link>
  );
}

export function ListaClientes({
  pendientes,
  completados,
}: {
  pendientes: ClienteResumen[];
  completados: ClienteResumen[];
}) {
  const [filtro, setFiltro] = useState("");
  const [mostrarCompletados, setMostrarCompletados] = useState(false);

  const pendientesFiltrados = useMemo(
    () => pendientes.filter((c) => coincide(c, filtro)),
    [pendientes, filtro]
  );
  const completadosFiltrados = useMemo(
    () => completados.filter((c) => coincide(c, filtro)),
    [completados, filtro]
  );

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Filtrar por nombre o código..."
        className="rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-400 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-50"
      />

      {pendientesFiltrados.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {pendientes.length === 0
            ? "No tienes clientes pendientes de entrega."
            : "Ningún cliente coincide con el filtro."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pendientesFiltrados.map((c) => (
            <li key={c.clienteKey}>
              <TarjetaCliente cliente={c} />
            </li>
          ))}
        </ul>
      )}

      {completados.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMostrarCompletados((v) => !v)}
            className="self-start text-sm font-medium text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            {mostrarCompletados ? "Ocultar" : "Ver"} clientes ya entregados (
            {completados.length})
          </button>
          {mostrarCompletados && (
            <ul className="flex flex-col gap-2">
              {completadosFiltrados.map((c) => (
                <li key={c.clienteKey}>
                  <TarjetaCliente cliente={c} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
