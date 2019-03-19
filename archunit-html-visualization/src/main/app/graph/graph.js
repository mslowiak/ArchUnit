'use strict';

const {buildFilterCollection} = require('./filter');

const init = (Root, Dependencies, View, visualizationStyles) => {

  const Graph = class {
    constructor(jsonGraph, violations, svg, svgContainerDivDomElement) {
      this._view = new View(svg);
      this.root = new Root(jsonGraph.root, svgContainerDivDomElement,
        (halfWidth, halfHeight) => this._view.renderWithTransition(halfWidth, halfHeight),
        (halfWidth, halfHeight) => this._view.render(halfWidth, halfHeight),
        newNodeFilterString => this.onNodeFilterStringChanged(newNodeFilterString));

      this._view.addRootView(this.root.view);

      this.dependencies = new Dependencies(jsonGraph.dependencies, this.root,
        {
          svgDetailedDependenciesContainer: this._view.svgElementForDetailedDependencies, svg: this._view.svgElement,
          svgCenterTranslater: this._view.translater
        });

      this.root.addListener(this.dependencies.createListener());
      this.root.getLinks = () => this.dependencies.getAllLinks();
      this.root.getNodesInvolvedInVisibleViolations = () => this.dependencies.getNodesInvolvedInVisibleViolations();
      this.root.getHasNodeVisibleViolation = () => this.dependencies.getHasNodeVisibleViolation();
      this.root.getDependenciesDirectlyWithinNode = node => this.dependencies.getDependenciesDirectlyWithinNode(node);

      this._createFilters();

      this.root.foldAllNodes();
      this.dependencies.recreateVisible();

      this.root.relayoutCompletely();
      this._violations = violations;
    }

    _updateFilterAndRelayout(filterKey) {
      this.root.doNextAndWaitFor(() => this._filterCollection.updateFilter(filterKey));
      this.root.relayoutCompletely();
    }

    _createFilters() {
      this._filterCollection = buildFilterCollection()
        .addFilterGroup(this.root.filterGroup)
        .addFilterGroup(this.dependencies.filterGroup)
        .build();

      this.root.filterGroup.getFilter('typeAndName').addDependentFilterKey('dependencies.nodeTypeAndName');
      this.root.filterGroup.getFilter('combinedFilter').addDependentFilterKey('dependencies.visibleNodes');
      this.dependencies.filterGroup.getFilter('type').addDependentFilterKey('nodes.visibleViolations');
      this.dependencies.filterGroup.getFilter('nodeTypeAndName').addDependentFilterKey('nodes.visibleViolations');
      this.dependencies.filterGroup.getFilter('violations').addDependentFilterKey('nodes.visibleViolations');

    }

    filterNodesByName(filterString) {
      this.root.nameFilterString = filterString;
      this._updateFilterAndRelayout('nodes.name');
    }

    filterNodesByType(filter) {
      this.root.changeTypeFilter(filter.showInterfaces, filter.showClasses);
      this._updateFilterAndRelayout('nodes.type');
    }

    filterDependenciesByType(typeFilterConfig) {
      this.dependencies.changeTypeFilter(typeFilterConfig);
      this._updateFilterAndRelayout('dependencies.type');
    }

    unfoldNodesToShowAllViolations() {
      const nodesContainingViolations = this.dependencies.getNodesContainingViolations();
      nodesContainingViolations.forEach(node => node.callOnEveryPredecessorThenSelf(node => node.unfold()));
      this.dependencies.recreateVisible();
      this.root.relayoutCompletely();
    }

    foldNodesWithMinimumDepthWithoutViolations() {
      this.root.foldNodesWithMinimumDepthThatHaveNoViolations();
      this.dependencies.recreateVisible();
      this.root.relayoutCompletely();
    }

    onNodeFilterStringChanged(newNodeFilterString) {
      this._menu.changeNodeNameFilter(newNodeFilterString);
      this.root.doNextAndWaitFor(() => this._filterCollection.updateFilter('nodes.name'));
    }

    attachToMenu(menu) {
      this._menu = menu;
      this._menu.initializeSettings(
        {
          initialCircleFontSize: visualizationStyles.getNodeFontSize(),
          initialCirclePadding: visualizationStyles.getCirclePadding()
        })
        .onSettingsChanged(
          (circleFontSize, circlePadding) => {
            visualizationStyles.setNodeFontSize(circleFontSize);
            visualizationStyles.setCirclePadding(circlePadding);
            this.root.relayoutCompletely();
          })
        .onNodeTypeFilterChanged(filter => this.filterNodesByType(filter))
        .initializeDependencyFilter(this.dependencies.dependencyTypes)
        .onDependencyFilterChanged(filter => this.filterDependenciesByType(filter))
        .onNodeNameFilterChanged((filterString) => this.filterNodesByName(filterString));
    }

    onHideNodesWithoutViolationsChanged(hide) {
      this._filterCollection.getFilter('nodes.visibleViolations').filterPrecondition.filterIsEnabled = hide;
      this._updateFilterAndRelayout('nodes.visibleViolations');
    }

    showViolations(violationsGroup) {
      this.dependencies.showViolations(violationsGroup);
      this._updateFilterAndRelayout('dependencies.violations');
    }

    hideViolations(violationsGroup) {
      this.dependencies.hideViolations(violationsGroup);
      this._updateFilterAndRelayout('dependencies.violations');
    }

    attachToViolationMenu(violationMenu) {
      violationMenu.initialize(this._violations,
        violationsGroup => this.showViolations(violationsGroup),
        violationsGroup => this.hideViolations(violationsGroup)
      );

      violationMenu.onHideAllDependenciesChanged(
        hide => {
          this._filterCollection.getFilter('dependencies.violations').filterPrecondition.filterIsEnabled = hide;
          this._updateFilterAndRelayout('dependencies.violations');
        });

      violationMenu.onHideNodesWithoutViolationsChanged(hide => this.onHideNodesWithoutViolationsChanged(hide));

      violationMenu.onClickUnfoldNodesToShowAllViolations(() => this.unfoldNodesToShowAllViolations());
      violationMenu.onClickFoldNodesToHideNodesWithoutViolations(() => this.foldNodesWithMinimumDepthWithoutViolations());
    }
  };

  return {
    Graph
  };
};

module.exports = {
  init: (appContext) => ({
    create: (svgElement, svgContainerDivElement) => {
      const Graph = init(appContext.getRoot(), appContext.getDependencies(),
        appContext.getGraphView(), appContext.getVisualizationStyles()).Graph;

      const visualizationData = appContext.getVisualizationData();
      return new Graph(visualizationData.jsonGraph, visualizationData.jsonViolations, svgElement, svgContainerDivElement);
    }
  })
};