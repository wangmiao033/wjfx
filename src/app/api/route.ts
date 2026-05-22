import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'FileShare API', version: '2.0' });
}
