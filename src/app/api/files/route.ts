import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket')
    const path = searchParams.get('path')

    if (!bucket || !path) {
      return NextResponse.json({ error: 'Missing bucket or path' }, { status: 400 })
    }

    const { data } = await supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error('Error getting public URL:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get public URL' }, 
      { status: 500 }
    )
  }
} 