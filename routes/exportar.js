const express = require('express');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Middleware: valida que el request venga de un usuario autenticado.
// Solo acepta el token por header Authorization (nunca por URL, para no filtrarlo).
async function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    // Cliente temporal con el JWT del usuario para validarlo
    const supabaseAuth = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error } = await supabaseAuth.auth.getUser();
    if (error || !user) {
        return res.status(401).json({ error: 'Sesión inválida' });
    }

    // Pasamos el cliente autenticado al siguiente handler — RLS aplicará
    req.supabase = supabaseAuth;
    next();
}

router.get('/exportar/patrocinadores', requireAuth, async (req, res) => {
    try {
        const supabase = req.supabase;

        const { data: patrocinadores, error: errPat } = await supabase
            .from('patrocinadores_2025')
            .select('*, categorias(nombre)')
            .order('id', { ascending: true });

        if (errPat) throw errPat;

        const { data: contactos, error: errCon } = await supabase
            .from('contactos_patrocinador')
            .select('*')
            .order('patrocinador_id', { ascending: true });

        if (errCon) throw errCon;

        const { data: finanzas, error: errFin } = await supabase
            .from('finanzas_2025')
            .select('*');

        if (errFin) throw errFin;

        const workbook = new ExcelJS.Workbook();

        // --- Hoja 1: Patrocinadores ---
        const sheet1 = workbook.addWorksheet('Patrocinadores');
        sheet1.columns = [
            { header: 'ID',                  key: 'id',                  width: 8  },
            { header: 'Patrocinador',         key: 'patrocinador',        width: 30 },
            { header: 'Categoria',            key: 'categoria',           width: 20 },
            { header: 'Monto Transferencia',  key: 'monto_transferencia', width: 22 },
            { header: 'Nota Credito',         key: 'nota_credito',        width: 18 },
            { header: 'Monto Especie',        key: 'monto_especie',       width: 18 },
            { header: 'Total Pagado',         key: 'monto_pagado_total',  width: 18 },
            { header: 'Falta Transferir',     key: 'falta_transferir',    width: 18 },
            { header: 'Descripcion',          key: 'descripcion',         width: 35 },
            { header: 'Descripcion Especie',  key: 'descripcion_especie', width: 35 },
        ];

        sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet1.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1A1A1A' },
        };
        sheet1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        patrocinadores.forEach(p => {
            sheet1.addRow({
                id:                  p.id,
                patrocinador:        p.patrocinador,
                categoria:           p.categorias?.nombre || '-',
                monto_transferencia: p.monto_transferencia || 0,
                nota_credito:        p.nota_credito || 0,
                monto_especie:       p.monto_especie || 0,
                monto_pagado_total:  p.monto_pagado_total || 0,
                falta_transferir:    p.falta_transferir || 0,
                descripcion:         p.descripcion || '',
                descripcion_especie: p.descripcion_especie || '',
            });
        });

        ['monto_transferencia', 'nota_credito', 'monto_especie', 'monto_pagado_total', 'falta_transferir'].forEach(key => {
            sheet1.getColumn(key).numFmt = '$#,##0.00';
        });

        // --- Fila de TOTALES de las columnas numéricas ---
        const sumTransfer = patrocinadores.reduce((s, p) => s + (p.monto_transferencia || 0), 0);
        const sumNota     = patrocinadores.reduce((s, p) => s + (p.nota_credito || 0), 0);
        const sumEspecie  = patrocinadores.reduce((s, p) => s + (p.monto_especie || 0), 0);
        const sumPagado   = patrocinadores.reduce((s, p) => s + (p.monto_pagado_total || 0), 0);
        const sumFalta    = patrocinadores.reduce((s, p) => s + (p.falta_transferir || 0), 0);

        const totalRow = sheet1.addRow({
            patrocinador:        'TOTALES',
            monto_transferencia: sumTransfer,
            nota_credito:        sumNota,
            monto_especie:       sumEspecie,
            monto_pagado_total:  sumPagado,
            falta_transferir:    sumFalta,
        });
        totalRow.font = { bold: true };
        totalRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E5DE' } };
        });

        // --- RESUMEN FINANCIERO (debajo de los patrocinadores) ---
        const fv = (clave) => {
            const f = (finanzas || []).find(x => x.clave === clave);
            return f ? (f.valor || 0) : 0;
        };

        const totalNCTransf    = sumNota + sumTransfer;
        const pendiente        = sumFalta;
        const transferRecibido = sumTransfer - sumFalta;
        const yaIngresado      = transferRecibido + sumNota
            + fv('jugadores_inscripciones') + fv('ingresos_cena_jugadores') + fv('ingresos_activaciones');
        const totalManual      = fv('jugadores_inscripciones') + fv('pago_previo_cenas')
            + fv('ingresos_cena_jugadores') + fv('ingresos_cena_quizz') + fv('ingresos_activaciones');
        const totalPrometido   = totalNCTransf + totalManual;
        const meta             = fv('meta_recaudacion');
        const diferencia       = totalPrometido - meta;

        sheet1.addRow([]); // separador
        sheet1.addRow([]);

        const tituloFin = sheet1.addRow(['', 'RESUMEN FINANCIERO 2025']);
        tituloFin.getCell(2).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        tituloFin.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };

        // Helper para agregar una fila de resumen: etiqueta en B, valor en D
        function addFin(label, value, opts = {}) {
            const row = sheet1.addRow(['', label, '', value]);
            const labelCell = row.getCell(2);
            const valueCell = row.getCell(4);
            valueCell.numFmt = '$#,##0.00';
            labelCell.font = { bold: !!opts.bold };
            valueCell.font = { bold: !!opts.bold };
            if (opts.fill) {
                [labelCell, valueCell].forEach(c => {
                    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
                    c.font = { bold: true, color: { argb: opts.textColor || 'FF000000' } };
                });
            }
            return row;
        }

        addFin('Meta Recaudación', meta, { bold: true });
        addFin('Total NC + Transferencias', totalNCTransf);
        addFin('Jugadores Inscripciones Portal', fv('jugadores_inscripciones'));
        addFin('Pago Previo de Acceso Cenas', fv('pago_previo_cenas'));
        addFin('Ingresos Dia de Cena Jugadores', fv('ingresos_cena_jugadores'));
        addFin('Ingresos Cena Quizz It', fv('ingresos_cena_quizz'));
        addFin('Ingresos Activaciones', fv('ingresos_activaciones'));
        addFin('TOTAL PROMETIDO', totalPrometido, { bold: true, fill: 'FFD1FAE5', textColor: 'FF065F46' });
        addFin('YA INGRESADO', yaIngresado, { fill: 'FF22C55E', textColor: 'FFFFFFFF' });
        addFin('PENDIENTE', pendiente, { fill: 'FFF59E0B', textColor: 'FFFFFFFF' });
        addFin(
            diferencia >= 0 ? 'META SUPERADA' : 'FALTA PARA LA META',
            Math.abs(diferencia),
            { fill: diferencia >= 0 ? 'FF15803D' : 'FFDC2626', textColor: 'FFFFFFFF' }
        );

        // --- Hoja 2: Contactos ---
        const sheet2 = workbook.addWorksheet('Contactos');
        sheet2.columns = [
            { header: 'ID',              key: 'id',            width: 8  },
            { header: 'Patrocinador',     key: 'patrocinador',  width: 30 },
            { header: 'Nombre Contacto',  key: 'nombre',        width: 30 },
            { header: 'Email',            key: 'email',         width: 30 },
            { header: 'Telefono',         key: 'telefono',      width: 20 },
        ];

        sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet2.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFB89469' },
        };
        sheet2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        contactos.forEach(c => {
            const pat = patrocinadores.find(p => p.id === c.patrocinador_id);
            sheet2.addRow({
                id:            c.id,
                patrocinador:  pat?.patrocinador || 'N/A',
                nombre:        c.nombre,
                email:         c.email || '',
                telefono:      c.telefono || '',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=patrocinadores_2025.xlsx');
        res.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Error exportando:', error);
        res.status(500).json({ error: 'Error al exportar datos' });
    }
});

module.exports = router;
