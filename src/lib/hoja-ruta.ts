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

export type PedidoConHoja = PedidoHojaRuta & { noHojaRuta: string };

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
 * Pedidos de un cliente (código o nombre) dentro de cualquiera de las hojas
 * de ruta indicadas, agrupados por (noHojaRuta, noPedido) — un mismo pedido
 * puede tener varias líneas (bultos/cajas distintas) en linHojaDeRutaReg, y
 * un mismo cliente puede tener pedidos en más de una hoja de ruta el mismo
 * día.
 */
export async function getPedidosPorClienteEnHojas(
  noHojasRuta: string[],
  clienteQuery: string
): Promise<PedidoConHoja[]> {
  if (noHojasRuta.length === 0) return [];

  const inputs: Record<string, unknown> = {
    clienteQuery: `%${clienteQuery}%`,
  };
  const placeholders = noHojasRuta.map((noHojaRuta, i) => {
    const key = `hr${i}`;
    inputs[key] = noHojaRuta;
    return `@${key}`;
  });

  return queryReadOnly<PedidoConHoja>(
    `select noHojaRuta, ${PEDIDO_COLUMNS}
     from linHojaDeRutaReg
     where noHojaRuta in (${placeholders.join(", ")})
       and noPedido <> ''
       and (codCliente like @clienteQuery or nombreCliente like @clienteQuery)
     group by noHojaRuta, noPedido
     order by noHojaRuta, noPedido`,
    inputs
  );
}

/**
 * Pedidos puntuales por par (noHojaRuta, noPedido) exacto — para releer del
 * ERP los datos autoritativos (cliente, dirección) de una selección hecha en
 * la UI, que puede combinar pedidos de distintas hojas de ruta.
 */
export async function getPedidosPorParesHojaPedido(
  pares: { noHojaRuta: string; noPedido: string }[]
): Promise<PedidoConHoja[]> {
  if (pares.length === 0) return [];

  const inputs: Record<string, unknown> = {};
  const condiciones = pares.map((par, i) => {
    const hojaKey = `h${i}`;
    const pedidoKey = `p${i}`;
    inputs[hojaKey] = par.noHojaRuta;
    inputs[pedidoKey] = par.noPedido;
    return `(noHojaRuta = @${hojaKey} and noPedido = @${pedidoKey})`;
  });

  return queryReadOnly<PedidoConHoja>(
    `select noHojaRuta, ${PEDIDO_COLUMNS}
     from linHojaDeRutaReg
     where ${condiciones.join(" or ")}
     group by noHojaRuta, noPedido`,
    inputs
  );
}
