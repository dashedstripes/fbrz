class FiberNode {
  id: string;
  layer: number;
  value: string;
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

  deleteText(offset: number) {
    const before = this.value.slice(0, offset - 1);
    const after = this.value.slice(offset);

    this.value = before + after;
  }

  addChild(child: FiberNode) {
    child.layer = this.layer + 1;
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

  render() {
    this.rootDiv.appendChild(this.root.render());
  }

  clearRender() {
    this.rootDiv.innerHTML = "";
  }
}

interface Cursor {
  focus: FiberNode;
  focusOffset: number;
  anchor: FiberNode;
  anchorOffset: number;
}

class Editor {
  tree: FiberTree;
  cursor: Cursor;

  constructor(id: string) {
    this.tree = new FiberTree(id);
    this.tree.root = new FiberNode("root", "root");

    this.cursor = {
      focus: this.tree.root,
      focusOffset: 0,
      anchor: this.tree.root,
      anchorOffset: 0,
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
          if (this.cursor.focusOffset === 0) {
            // merge with previous node
          } else if (this.cursor.focus.id === this.cursor.anchor.id) {
            this.cursor.focus.deleteText(this.cursor.focusOffset);
            this.cursor.anchorOffset -= 1;
            this.cursor.focusOffset -= 1;
            this.cursor.focus.updateRenderedValue();
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

editor.tree.root.addChild(new FiberNode("c1", "child1"));
editor.tree.root.addChild(new FiberNode("c2", "child2"));

editor.tree.root.firstChild().addChild(new FiberNode("c1.1", "child1.1"));
editor.tree.root.firstChild().addChild(new FiberNode("c1.2", "child1.2"));

editor.tree.root.lastChild().addChild(new FiberNode("c2.1", "child2.1"));

editor.render();
