import {useState} from 'react';
type Project={id:number;name:string;description:string;category:string;progress:number;color:string};
export function ProjectActions({project,onSave,onDelete}:{project:Project,onSave:(p:Project)=>void,onDelete:()=>void}){
  const [editing,setEditing]=useState(false);
  return <div className="project-actions"><button className="text-button" onClick={()=>setEditing(true)}>프로젝트 수정</button><button className="text-button" onClick={()=>{if(window.confirm('「'+project.name+'」 프로젝트를 목록에서 삭제할까요? 연결된 연구 기록은 기기에 보관됩니다.'))onDelete()}}>삭제</button>
  {editing&&<div className="modal-backdrop"><form className="modal" role="dialog" aria-label="프로젝트 수정" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);const name=String(data.get('name')).trim();if(!name)return;onSave({...project,name,description:String(data.get('description')).trim(),category:String(data.get('category')).trim()});setEditing(false)}}><h2>프로젝트 수정</h2><label>프로젝트명<input name="name" required pattern=".*\S.*" defaultValue={project.name} autoFocus/></label><label>분류<input name="category" defaultValue={project.category}/></label><label>설명<textarea name="description" defaultValue={project.description}/></label><button type="button" onClick={()=>setEditing(false)}>취소</button><button className="primary">변경 저장</button></form></div>}</div>
}
