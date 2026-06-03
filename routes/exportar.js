const express = require('express');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

router.get('/exportar/patrocinadores', async (req, res) => {
    try {
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
            fgColor: { argb: 'FF2563EB' },
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
            fgColor: { argb: 'FF15803D' },
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
