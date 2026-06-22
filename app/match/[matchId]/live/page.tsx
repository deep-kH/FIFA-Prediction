import { redirect } from 'next/navigation'

export default async function LiveArenaPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  // The standalone live page is deprecated. Redirect to dashboard to open the global widget.
  redirect(`/dashboard?live=${matchId}`)
}
