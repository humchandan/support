export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  
  if (!address) {
    return Response.json({ error: 'Address is required' }, { status: 400 });
  }
  
  const timestamp = Date.now();
  const challenge = `Sign to log into Aries MLM Portal:\nAddress: ${address.toLowerCase()}\nTimestamp: ${timestamp}`;
  
  return Response.json({ challenge, timestamp });
}
