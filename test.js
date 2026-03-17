import supabase from "./supabaseClient.js"

async function test() {

  const { data, error } = await supabase
    .from("patrocinadores_2025")
    .select("*")

  console.log("Datos:", data)
  console.log("Error:", error)

}

test()