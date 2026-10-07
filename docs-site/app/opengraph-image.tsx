import { ImageResponse } from 'next/og';

export const alt = 'Owarine Docs — step-by-step guides to the Canton test network build';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The share image is rendered locally at build time, with the product mark's exact SVG geometry. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width:'100%',height:'100%',display:'flex',flexDirection:'column',background:'#F2F2F2',color:'#0A0A0A',padding:'52px 64px',fontFamily:'sans-serif' }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',paddingBottom:32,borderBottom:'1px solid #CAC9C3' }}>
        <span style={{ color:'#FA00FF',fontSize:18,letterSpacing:3 }}>THE OWARINE HANDBOOK</span>
        <div style={{ display:'flex',alignItems:'center',gap:13 }}>
          <svg width="43" height="43" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 0H151L183 32V61H139V44H44V176H176V82H220V220H0Z" fill="#0A0A0A" />
            <path d="M173 0H220V47Z" fill="#FA00FF" />
          </svg>
          <span style={{ fontSize:30,fontWeight:700 }}>Owarine</span>
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',marginTop:52 }}>
        <span style={{ fontSize:74,fontWeight:700,letterSpacing:-3,lineHeight:1.08 }}>Owarine,</span>
        <span style={{ fontSize:74,fontWeight:700,letterSpacing:-3,lineHeight:1.08,color:'#FA00FF' }}>explained simply.</span>
        <span style={{ fontSize:25,lineHeight:1.5,color:'#5E5D54',marginTop:24 }}>Step-by-step guides to an Up/Down prediction market on Canton.</span>
      </div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'auto',paddingTop:28,borderTop:'1px solid #CAC9C3' }}>
        <div style={{ display:'flex',gap:12 }}>
          {['Make a call','Sessions and lanes','Read the architecture'].map((label) => <span key={label} style={{ display:'flex',fontSize:18,border:'1px solid #CAC9C3',borderRadius:24,padding:'10px 20px',background:'#FFFFFF' }}>{label}</span>)}
        </div>
        <span style={{ color:'#5E5D54',fontSize:18 }}>Documentation</span>
      </div>
    </div>,
    size,
  );
}
