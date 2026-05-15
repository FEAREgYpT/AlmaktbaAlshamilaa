import { useEffect, useState } from 'react'; import api from '../../lib/api';
export default function BiblicalTree(){ const [rows,setRows]=useState<any[]>([]); useEffect(()=>{api.get('/categories').then(r=>setRows(r.data));},[]); return <div><h3>Tree</h3>{rows.slice(0,8).map(r=><div key={r.id}>{r.name_en||r.title_en}</div>)}</div>; }
