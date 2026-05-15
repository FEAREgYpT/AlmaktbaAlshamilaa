import { Router } from 'express'; const router=Router();
router.get('/',(req,res)=>{const table=req.baseUrl.split('/').pop()?.replace('-','_')||''; const rows=(req as any).db.prepare(`SELECT * FROM ${table}`).all();res.json(rows);});
router.get('/:id',(req,res)=>{const table=req.baseUrl.split('/').pop()?.replace('-','_')||''; const row=(req as any).db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(req.params.id); if(!row) return res.status(404).json({error:'Not found'}); res.json(row);});
router.post('/',(req,res)=>{const table=req.baseUrl.split('/').pop()?.replace('-','_')||''; const keys=Object.keys(req.body); const vals=Object.values(req.body); const q=`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`; const info=(req as any).db.prepare(q).run(...vals); res.status(201).json({id:info.lastInsertRowid});});
router.put('/:id',(req,res)=>{const table=req.baseUrl.split('/').pop()?.replace('-','_')||''; const keys=Object.keys(req.body); const vals=Object.values(req.body); const q=`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`; (req as any).db.prepare(q).run(...vals,req.params.id); res.json({ok:true});});
router.delete('/:id',(req,res)=>{const table=req.baseUrl.split('/').pop()?.replace('-','_')||''; (req as any).db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id); res.json({ok:true});});
export default router;
