class FiberNode {
  id: string;
  layer: number;
  value: string;
  parent: FiberNode | null = null;
  children: FiberNode[] = [];

  constructor(id: string, value: string, layer: number = 0) {
    this.id = id;
    this.value = value;
    this.layer = layer;
  }

  insertText(offset: number, text: string) {
    const before = this.value.slice(0, offset);
    const after = this.value.slice(offset);

    this.value = before + text + after;
  }

  deleteText(anchorOffset: number, focusOffset: number) {
    if (anchorOffset > focusOffset) {
      const tmp = anchorOffset;
      anchorOffset = focusOffset;
      focusOffset = tmp;
    }

    if (anchorOffset === focusOffset) {
      const before = this.value.slice(0, focusOffset - 1);
      const after = this.value.slice(focusOffset);
      this.value = before + after;
    } else {
      const start = this.value.slice(0, anchorOffset);
      const end = this.value.slice(focusOffset);

      this.value = start + end;
    }
  }

  addChild(child: FiberNode, tree: FiberTree) {
    child.layer = this.layer + 1;
    child.parent = this;
    tree.count += 1;

    this.children.push(child);
  }

  firstChild() {
    return this.children[0];
  }

  nthChild(n: number) {
    return this.children[n];
  }

  lastChild() {
    return this.children[this.children.length - 1];
  }

  updateRenderedValue() {
    const container = document.getElementById(this.id) as HTMLElement;
    let pElement = container.querySelector("p");
    if (!pElement) {
      pElement = document.createElement("p");
      container.appendChild(pElement);
    }
    pElement.textContent = this.value;
  }

  render() {
    const element = document.createElement("div");
    element.id = this.id;

    const pElement = document.createElement("p");

    pElement.textContent = this.value;

    element.appendChild(pElement);

    if (this.layer > 0) {
      element.style.marginLeft = `${this.layer * 20}px`;
    }

    this.children.forEach((child: FiberNode) => {
      const childEl = child.render();
      element.appendChild(childEl);
    });

    return element;
  }
}

class FiberTree {
  root: FiberNode;
  rootDiv: HTMLElement;
  count: number = 0;

  constructor(rootId: string) {
    const rootDiv = document.getElementById(rootId) as HTMLElement;
    rootDiv.contentEditable = "true";
    rootDiv.style.whiteSpace = "pre-wrap";

    this.rootDiv = rootDiv;
  }

  findNodeById(id: string, node: FiberNode) {
    if (node.id === id) {
      return node;
    }

    for (let i = 0; i < node.children.length; i++) {
      const found = this.findNodeById(id, node.children[i]);

      if (found) {
        return found;
      }
    }
  }

  findCommonAncestor(anchor: string, focus: string) {
    const anchorNode = this.findNodeById(anchor, this.root);
    const focusNode = this.findNodeById(focus, this.root);

    const anchorAncestors: FiberNode[] = [];
    let n = anchorNode;

    while (n) {
      anchorAncestors.push(n);
      n = n.parent;
    }

    let commonAncestor = null;
    n = focusNode;

    while (n) {
      if (anchorAncestors.includes(n)) {
        commonAncestor = n;
        break;
      }
      n = n.parent;
    }

    return commonAncestor;
  }

  findNodesBetween(
    anchor: FiberNode,
    focus: FiberNode,
    direction: "forward" | "backward",
  ) {
    const commonAncestor = this.findCommonAncestor(anchor.id, focus.id);
    if (!commonAncestor) return;

    const nodesInRange: FiberNode[] = [];
    let inRange = false;

    if (direction === "backward") {
      const tmp = anchor;
      anchor = focus;
      focus = tmp;
    }

    function traverse(n: FiberNode) {
      if (n === null) {
        return;
      }

      if (n.id == anchor.id) {
        inRange = true;
      }

      if (inRange && n.id !== "root") {
        nodesInRange.push(n);
      }

      if (n.id == focus.id) {
        inRange = false;
        return;
      }

      for (let i = 0; i < n.children.length; i++) {
        const child = n.children[i];
        traverse(child);
      }
    }

    traverse(commonAncestor);

    return nodesInRange;
  }

  deleteDOMNodes(
    nodes: FiberNode[],
    anchor: FiberNode,
    focus: FiberNode,
    anchorOffset: number,
    focusOffset: number,
    cursorDirection: "forward" | "backward",
  ) {
    if (cursorDirection === "backward") {
      const tmp = anchor;
      anchor = focus;
      focus = tmp;
      const tmpOffset = anchorOffset;
      anchorOffset = focusOffset;
      focusOffset = tmpOffset;
    }

    // merge the text of the anchor and focus nodes
    if (anchor.id !== focus.id) {
      anchor.value =
        anchor.value.slice(0, anchorOffset) + focus.value.slice(focusOffset);
      anchor.updateRenderedValue();
      anchor.children = focus.children;

      const anchorParent = anchor.parent;
      if (!anchorParent) return;

      const parent = document.getElementById(anchorParent.id);
      if (!parent) return;

      parent.replaceWith(anchorParent.render());
    }

    nodes.forEach((node) => {
      if (node.id === anchor.id) return;
      const el = document.getElementById(node.id);
      if (!el) return;
      if (!el.firstChild) return;
      let p = el.firstChild as HTMLElement;
      p.style.textDecoration = "line-through";
      el.remove();
    });
  }

  render() {
    this.rootDiv.appendChild(this.root.render());
  }

  clearRender() {
    this.rootDiv.innerHTML = "";
  }
}

interface Cursor {
  anchor: FiberNode;
  anchorOffset: number;
  focus: FiberNode;
  focusOffset: number;
  direction: "forward" | "backward";
}

class Editor {
  tree: FiberTree;
  cursor: Cursor;

  constructor(id: string) {
    this.tree = new FiberTree(id);
    this.tree.root = new FiberNode("root", "root");

    this.cursor = {
      anchor: this.tree.root,
      anchorOffset: 0,
      focus: this.tree.root,
      focusOffset: 0,
      direction: "forward",
    };

    this.tree.rootDiv.onbeforeinput = (e) => {
      e.preventDefault();

      switch (e.inputType) {
        case "insertText": {
          const text = e.data || "";
          this.cursor.focus.insertText(this.cursor.focusOffset, text);
          this.cursor.focusOffset += 1;
          this.cursor.focus.updateRenderedValue();
          this.restoreCursor();
          break;
        }
        case "deleteContentBackward": {
          if (this.cursor.focusOffset === 0 && this.cursor.anchorOffset === 0) {
            // merge with previous node
          } else if (this.cursor.focus.id === this.cursor.anchor.id) {
            this.cursor.focus.deleteText(
              this.cursor.anchorOffset,
              this.cursor.focusOffset,
            );

            this.cursor.anchorOffset -= 1;
            this.cursor.focusOffset -= 1;

            this.cursor.focus.updateRenderedValue();
            this.restoreCursor();
          } else {
            // delete range
            const anchorNode = this.tree.findNodeById(
              this.cursor.anchor.id,
              this.tree.root,
            );
            const focusNode = this.tree.findNodeById(
              this.cursor.focus.id,
              this.tree.root,
            );

            const nodesInRange = this.tree.findNodesBetween(
              anchorNode,
              focusNode,
              this.cursor.direction,
            );

            if (!nodesInRange) return;

            this.tree.deleteDOMNodes(
              nodesInRange,
              anchorNode,
              focusNode,
              this.cursor.anchorOffset,
              this.cursor.focusOffset,
              this.cursor.direction,
            );

            if (this.cursor.direction === "forward") {
              this.cursor.focus = this.cursor.anchor;
            } else {
              this.cursor.anchor = this.cursor.focus;
            }

            this.restoreCursor();
          }
          break;
        }
      }
    };

    document.onselectionchange = () => {
      const selection = document.getSelection();
      const anchorNode = selection?.anchorNode;
      const focusNode = selection?.focusNode;

      if (!anchorNode || !focusNode) return;

      const closestParentAnchor = this.findNearestParentDiv(anchorNode as Node);

      if (!closestParentAnchor) return;

      const anchorFiberNode = this.tree.findNodeById(
        closestParentAnchor.id,
        this.tree.root,
      );

      const closestParentFocus = this.findNearestParentDiv(focusNode as Node);

      if (!closestParentFocus) return;

      const focusFiberNode = this.tree.findNodeById(
        closestParentFocus.id,
        this.tree.root,
      );

      this.cursor = {
        focus: focusFiberNode,
        focusOffset: selection?.focusOffset || 0,
        anchor: anchorFiberNode,
        anchorOffset: selection?.anchorOffset || 0,
        direction:
          selection?.anchorNode.compareDocumentPosition(selection?.focusNode) &
          Node.DOCUMENT_POSITION_FOLLOWING
            ? "forward"
            : "backward",
      };
    };
  }

  findNearestParentDiv(node: Node): HTMLElement | null {
    if (!node) return null;

    let n = node;

    while (n.parentNode && n.parentNode.nodeName !== "DIV") {
      n = n.parentNode;
    }

    return n.parentNode as HTMLElement;
  }

  restoreCursor() {
    const selection = document.getSelection();
    const range = document.createRange();

    const anchorNode = document.getElementById(this.cursor.anchor.id);
    const focusNode = document.getElementById(this.cursor.focus.id);

    if (!anchorNode || !focusNode) return;

    range.setStart(
      anchorNode.firstChild?.firstChild as Node,
      this.cursor.anchorOffset,
    );
    range.setEnd(
      focusNode.firstChild?.firstChild as Node,
      this.cursor.focusOffset,
    );

    selection?.removeAllRanges();
    selection?.addRange(range);
    selection?.collapseToEnd();
  }

  render() {
    this.tree.render();
  }
}

const editor = new Editor("app");

editor.tree.root.addChild(new FiberNode("c1", "child1"), editor.tree);
editor.tree.root.addChild(new FiberNode("c2", "child2"), editor.tree);

editor.tree.root
  .firstChild()
  .addChild(new FiberNode("c1.1", "child1.1"), editor.tree);
editor.tree.root
  .firstChild()
  .addChild(new FiberNode("c1.2", "child1.2"), editor.tree);
editor.tree.root
  .firstChild()
  .lastChild()
  .addChild(new FiberNode("c1.2.1", "child1.2.1"), editor.tree);

editor.tree.root
  .lastChild()
  .addChild(new FiberNode("c2.1", "child2.1"), editor.tree);

editor.render();
