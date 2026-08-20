import { queryReadOnly } from "@/lib/sql-server";

/**
 * Formatea una columna `date` de SQL Server (sin hora) a "DD/MM/YYYY".
 * Usa los componentes UTC a propósito: el driver la entrega como medianoche
 * UTC, y formatear con hora local la corre un día hacia atrás en zonas
 * detrás de UTC (ej. Guatemala).
 */
export function formatearFechaSql(valor: string | Date | null): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${fecha.getUTCFullYear()}`;
}

export type HojaRuta = {
  noHojaRuta: string;
  fechaPlanificacionTransporte: string | null;
  fechaRegistro: string | null;
  chofer: string | null;
  nombreChofer: string | null;
  codTransportista: string | null;
  nombreTransportista: string | null;
  placa: string | null;
  zona: string | null;
  comentario: string | null;
};

export type PedidoHojaRuta = {
  noPedido: string;
  codCliente: string | null;
  nombreCliente: string | null;
  direccionDeEnvio: string | null;
  noFactura: string | null;
  noGuia: string | null;
  noConduce: string | null;
  fechaEntregaRequerida: string | null;
  monto: number | null;
  peso: number | null;
  cantidadDeBultos: number | null;
};

const HOJA_RUTA_COLUMNS = `
  noHojaRuta,
  fechaPlanificacionTransporte,
  fechaRegistro,
  chofer,
  nombreChofer,
  codTransportista,
  nombreTransportista,
  placa,
  zona,
  comentario
`;

const PEDIDO_COLUMNS = `
  noPedido,
  max(codCliente) as codCliente,
  max(nombreCliente) as nombreCliente,
  max(direccionDeEnvio) as direccionDeEnvio,
  max(noFactura) as noFactura,
  max(noGuia) as noGuia,
  max(noConduce) as noConduce,
  max(fechaEntregaRequerida) as fechaEntregaRequerida,
  sum(monto) as monto,
  sum(peso) as peso,
  sum(cantidadDeBultos) as cantidadDeBultos
`;

/**
 * Hojas de ruta registradas en un día (rango [fecha, fecha+1)).
 * `fechaISO` va en formato "YYYY-MM-DD" y se manda a SQL Server como texto
 * plano — nada de objetos Date, para no arrastrar la zona horaria del
 * servidor Node al comparar contra una columna `date` (sin hora ni offset).
 */
export async function getHojasRutaPorFecha(fechaISO: string): Promise<HojaRuta[]> {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fin = new Date(Date.UTC(anio, mes - 1, dia + 1)).toISOString().slice(0, 10);

  return queryReadOnly<HojaRuta>(
    `select ${HOJA_RUTA_COLUMNS}
     from cabHojaDeRutaReg
     where anulada = 0
       and fechaRegistro >= @inicio
       and fechaRegistro < @fin
     order by noHojaRuta`,
    { inicio: fechaISO, fin }
  );
}

/** Encabezados de hoja de ruta por número exacto (para "mis rutas asignadas"). */
export async function getHojasRutaPorNumeros(
  noHojaRutas: string[]
): Promise<HojaRuta[]> {
  if (noHojaRutas.length === 0) return [];

  const inputs: Record<string, unknown> = {};
  const placeholders = noHojaRutas.map((noHojaRuta, i) => {
    const key = `hr${i}`;
    inputs[key] = noHojaRuta;
    return `@${key}`;
  });

  return queryReadOnly<HojaRuta>(
    `select ${HOJA_RUTA_COLUMNS}
     from cabHojaDeRutaReg
     where noHojaRuta in (${placeholders.join(", ")})
     order by fechaPlanificacionTransporte desc, noHojaRuta`,
    inputs
  );
}

/**
 * Pedidos de una hoja de ruta cuyo cliente coincide con el texto buscado
 * (código o nombre), agrupados por noPedido — una misma orden puede tener
 * varias líneas (bultos/cajas distintas) en linHojaDeRutaReg.
 */
export async function getPedidosPorHojaYCliente(
  noHojaRuta: string,
  clienteQuery: string
): Promise<PedidoHojaRuta[]> {
  return queryReadOnly<PedidoHojaRuta>(
    `select ${PEDIDO_COLUMNS}
     from linHojaDeRutaReg
     where noHojaRuta = @noHojaRuta
       and noPedido <> ''
       and (codCliente like @clienteQuery or nombreCliente like @clienteQuery)
     group by noPedido
     order by noPedido`,
    { noHojaRuta, clienteQuery: `%${clienteQuery}%` }
  );
}

/** Pedidos puntuales de una hoja de ruta por número exacto (para confirmar entregas). */
export async function getPedidosPorNumeros(
  noHojaRuta: string,
  noPedidos: string[]
): Promise<PedidoHojaRuta[]> {
  if (noPedidos.length === 0) return [];

  const inputs: Record<string, unknown> = { noHojaRuta };
  const placeholders = noPedidos.map((noPedido, i) => {
    const key = `np${i}`;
    inputs[key] = noPedido;
    return `@${key}`;
  });

  return queryReadOnly<PedidoHojaRuta>(
    `select ${PEDIDO_COLUMNS}
     from linHojaDeRutaReg
     where noHojaRuta = @noHojaRuta
       and noPedido in (${placeholders.join(", ")})
     group by noPedido`,
    inputs
  );
}
