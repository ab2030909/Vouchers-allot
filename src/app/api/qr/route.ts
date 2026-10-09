import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get('format') || 'png';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const claimUrl = `${baseUrl}/`;

    if (format === 'svg') {
      const svgString = await QRCode.toString(claimUrl, {
        type: 'svg',
        color: {
          dark: '#00F0FF',
          light: '#080C14',
        },
        margin: 2,
        width: 300,
      });
      return new NextResponse(svgString, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    const dataUrl = await QRCode.toDataURL(claimUrl, {
      color: {
        dark: '#00F0FF',
        light: '#080C14',
      },
      margin: 2,
      width: 400,
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json({ success: false, message: 'Failed to generate QR code.' }, { status: 500 });
  }
}
