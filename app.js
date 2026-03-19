const supabaseUrl = "TU_URL_SUPABASE"
const supabaseKey = "TU_ANON_KEY"

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey)

async function cargarPatrocinadores(){

const { data } = await supabaseClient
.from("patrocinadores_2025")
.select("*")

const tabla = document.getElementById("patrocinadoresBody")
tabla.innerHTML=""

data.forEach(p => {

tabla.innerHTML += `
<tr>
<td>${p.id}</td>
<td>${p.patrocinador}</td>
<td>${p.categoria}</td>
<td>${p.monto_transferencia}</td>
<td>${p.nota_credito}</td>
<td>${p.monto_especie}</td>
<td>${p.monto_pagado_total}</td>
<td>${p.falta_transferir}</td>
<td>${p.descripcion ?? ""}</td>
</tr>
`

})

}

async function cargarContactos(){

const { data } = await supabaseClient
.from("contactos_patrocinador")
.select("*")

const tabla = document.getElementById("contactosBody")
tabla.innerHTML=""

data.forEach(c => {

tabla.innerHTML += `
<tr>
<td>${c.id}</td>
<td>${c.patrocinador_id}</td>
<td>${c.nombre}</td>
<td>${c.email}</td>
<td>${c.telefono}</td>
</tr>
`

})

}

cargarPatrocinadores()
cargarContactos()