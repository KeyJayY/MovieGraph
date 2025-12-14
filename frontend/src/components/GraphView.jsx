import React, { useRef, useEffect, useState, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphView = ({ data, onNodeClick, onNodeDoubleClick }) => {
  const fgRef = useRef();
  
  const lastClickTime = useRef(0);

  const [hoverNode, setHoverNode] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge').strength(-400); 
      fgRef.current.d3Force('link').distance(100);
    }
  }, [data]);

  const getNodeRadius = (group) => {
    switch (group) {
        case 'input': return 12;          
        case 'recommendation': return 16; 
        case 'movie': return 10;          
        case 'person': return 7;         
        case 'genre': return 12;
        case 'keyword': return 5;
        default: return 5;
    }
  };

  const isLinkHighlighted = useCallback((link) => {
    if (hoverLink && hoverLink === link) return true;
    if (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) return true;
    return false;
  }, [hoverLink, hoverNode]);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeId="id"
        
        onNodeHover={(node) => setHoverNode(node || null)}
        onLinkHover={(link) => setHoverLink(link || null)}

        nodeCanvasObject={(node, ctx, globalScale) => {
          const label = node.id;
          const radius = getNodeRadius(node.group);
          let color = '#888';
          if (node.group === 'input') color = '#e50914';          
          else if (node.group === 'recommendation') color = '#42f554'; 
          else if (node.group === 'movie') color = '#e50914';     
          else if (node.group === 'person') color = '#4a90e2';    
          else if (node.group === 'genre') color = '#ffd700';     
          else if (node.group === 'keyword') color = '#bdc3c7';   

          let isDimmed = false;
          if (hoverNode && hoverNode.id !== node.id) isDimmed = true;
          if (hoverLink && (hoverLink.source.id === node.id || hoverLink.target.id === node.id)) isDimmed = false;

          ctx.globalAlpha = isDimmed ? 0.2 : 1; 

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();

          const showLabel = node.group !== 'keyword' || globalScale > 1.8 || hoverNode === node;
          if (showLabel) {
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px Sans-Serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = isDimmed ? 0.3 : 1;
              ctx.fillText(label, node.x, node.y + radius + 2);
          }
          ctx.globalAlpha = 1; 
        }}

        linkCanvasObject={(link, ctx, globalScale) => {
            const highlighted = isLinkHighlighted(link);
            const isDimmed = (hoverNode || hoverLink) && !highlighted;
            ctx.beginPath();
            ctx.moveTo(link.source.x, link.source.y);
            ctx.lineTo(link.target.x, link.target.y);
            ctx.strokeStyle = link.color || '#999';
            if (isDimmed) {
                ctx.globalAlpha = 0.2; 
                ctx.lineWidth = 1 / globalScale;
            } else if (highlighted) {
                ctx.globalAlpha = 1;
                ctx.lineWidth = 3 / globalScale;
            } else {
                ctx.globalAlpha = 0.6;
                ctx.lineWidth = 1.5 / globalScale;
            }
            ctx.stroke();
            ctx.globalAlpha = 1; 
            if (highlighted && link.label) {
                const midX = (link.source.x + link.target.x) / 2;
                const midY = (link.source.y + link.target.y) / 2;
                const fontSize = 4; 
                ctx.font = `bold ${fontSize}px Sans-Serif`;
                const textWidth = ctx.measureText(link.label).width;
                const padding = 1;
                ctx.save();
                ctx.translate(midX, midY);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
                ctx.fillRect(-textWidth/2 - padding, -fontSize/2 - padding, textWidth + 2*padding, fontSize + 2*padding);
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = link.color;
                ctx.fillText(link.label, 0, 0);
                ctx.restore();
            }
        }}
        
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={(link) => isLinkHighlighted(link) ? link.color : '#333'}
        linkDirectionalArrowLength={(link) => isLinkHighlighted(link) ? 4 : 2}

        onNodeClick={(node) => {
          if (node.group === 'genre' || node.group === 'keyword') return;

          const now = Date.now();
          if (now - lastClickTime.current < 300) {
             onNodeDoubleClick(node.id); 
          } else {
             onNodeClick(node);
          }
          
          lastClickTime.current = now;
        }}
      />
    </div>
  );
};

export default GraphView;