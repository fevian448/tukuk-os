export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    url.hostname = "tukuk.org";
    
    try {
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "follow"
      });
      
      // Jika pelayan membalas dengan ralat pelayan (5xx), papar halaman sandaran
      if (response.status >= 500) {
        throw new Error("Server error");
      }
      
      return response;
    } catch (err) {
      // Halaman penyelenggaraan apabila pelayan fizikal/tunnel mati
      return new Response(
        "<!DOCTYPE html><html><head><title>Tukuk - Penyelenggaraan</title></head><body style='font-family:sans-serif;text-align:center;padding:50px;'><h1>Sistem Sedang Diselenggara</h1><p>Maaf, pelayan utama kami sedang mengalami gangguan sementara atau dalam penyelenggaraan. Sila cuba sebentar lagi.</p></body></html>",
        {
          status: 503,
          headers: { "Content-Type": "text/html;charset=UTF-8" },
        }
      );
    }
  },
};
