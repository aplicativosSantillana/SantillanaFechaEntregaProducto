import { NextResponse } from "next/server";
import { queryReadOnly } from "@/lib/sql-server";

export async function GET() {
  try {
    const rows = await queryReadOnly<{ now: string; db: string }>(
      "SELECT GETDATE() AS now, DB_NAME() AS db"
    );
    return NextResponse.json({ ok: true, rows });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
